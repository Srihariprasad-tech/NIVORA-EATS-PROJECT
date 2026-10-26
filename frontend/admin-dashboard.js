// =====================================================
// Admin dashboard
// GET    /users                  -> { result: [...] }
// PATCH  /users/:id              { role }
// DELETE /users/:id
// GET    /orders/admin/all       -> { orders, total }
// PATCH  /orders/:id/status      { status }
// PATCH  /orders/:id/cancel
// =====================================================

const adminUser = requireLogin(["admin"]);

const usersBody = document.getElementById("users-body");
const ordersBody = document.getElementById("orders-body");

const ROLE_LABEL = { customer: "Customer", cook: "Home Cook", admin: "Admin", delivery: "Delivery" };
const ADMIN_NEXT = {
  confirmed: ["preparing", "Preparing"],
  preparing: ["ready", "Ready"],
  ready: ["out_for_delivery", "Out for delivery"],
  out_for_delivery: ["delivered", "Delivered"]
};
const STATUS_TEXT = {
  confirmed: "Confirmed", preparing: "Preparing", ready: "Ready",
  out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled"
};

function messageRow(body, text) {
  const row = el("tr");
  const cell = el("td", "", text);
  cell.colSpan = 5;
  row.append(cell);
  body.replaceChildren(row);
}

// ---------- Users ----------
async function loadUsers() {
  try {
    const data = await apiFetch("/users");
    const users = data.result || [];
    document.getElementById("user-count").textContent = users.length + (users.length === 1 ? " User" : " Users");
    if (users.length === 0) return messageRow(usersBody, "No users yet.");

    usersBody.replaceChildren(...users.map((user, index) => {
      const row = el("tr");

      const nameCell = el("td");
      const info = el("div", "user-info");
      info.append(el("div", "user-avatar", (user.name || "?").charAt(0).toUpperCase()), el("span", "", user.name));
      nameCell.append(info);

      const roleCell = el("td");
      const isMe = String(user._id) === String(adminUser._id);
      if (isMe) {
        roleCell.append(el("span", "role " + user.role, ROLE_LABEL[user.role] + " (you)"));
      } else {
        const select = el("select", "role " + user.role);
        select.setAttribute("aria-label", "Role of " + user.name);
        ["customer", "cook", "delivery", "admin"].forEach(role => select.append(new Option(ROLE_LABEL[role], role)));
        select.value = user.role;
        select.addEventListener("change", () => changeRole(user, select));
        roleCell.append(select);
      }

      const actionCell = el("td");
      if (!isMe) {
        const remove = el("button", "delete-btn");
        remove.type = "button";
        remove.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
        remove.addEventListener("click", () => deleteUser(user));
        actionCell.append(remove);
      }

      row.append(el("td", "", String(index + 1).padStart(2, "0")), nameCell, el("td", "", user.email), roleCell, actionCell);
      return row;
    }));
  } catch (error) {
    messageRow(usersBody, error.message);
  }
}

async function changeRole(user, select) {
  const role = select.value;
  if (role === "admin" && !confirm(`Make ${user.name} an admin? Admins can delete users and cancel orders.`)) {
    select.value = user.role;
    return;
  }
  try {
    await apiFetch("/users/" + user._id, { method: "PATCH", body: { role } });
    user.role = role;
    select.className = "role " + role;
    showToast(`${user.name} is now ${ROLE_LABEL[role]}. They need to log in again.`);
  } catch (error) {
    select.value = user.role;
    showToast(error.message, true);
  }
}

async function deleteUser(user) {
  if (!confirm(`Delete ${user.name} (${user.email})? This cannot be undone.`)) return;
  try {
    await apiFetch("/users/" + user._id, { method: "DELETE" });
    showToast("User deleted");
    loadUsers();
  } catch (error) {
    showToast(error.message, true);
  }
}

// ---------- Orders ----------
async function loadAdminOrders() {
  try {
    const data = await apiFetch("/orders/admin/all?limit=50");
    const orders = data.orders || [];
    document.getElementById("order-count").textContent = (data.total || 0) + ((data.total === 1) ? " Order" : " Orders");
    if (orders.length === 0) return messageRow(ordersBody, "No orders yet.");

    ordersBody.replaceChildren(...orders.map(order => {
      const row = el("tr");

      const orderCell = el("td");
      orderCell.append(el("strong", "", order.orderNumber), el("br"),
        el("small", "", new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })));

      const customer = order.user ? `${order.user.name} (${order.user.email})` : "-";
      const items = order.items.map(item => `${item.foodName} × ${item.quantity}`).join(", ");
      const customerCell = el("td");
      customerCell.append(customer, el("br"), el("small", "", items));

      const statusCell = el("td");
      statusCell.append(el("span", "role " + (order.orderStatus === "cancelled" ? "cook" : "customer"),
        STATUS_TEXT[order.orderStatus] || order.orderStatus));
      if (order.paymentStatus !== "paid") statusCell.append(el("br"), el("small", "", order.paymentStatus.replace("_", " ")));

      const actionCell = el("td");
      const next = ADMIN_NEXT[order.orderStatus];
      if (next) {
        const move = el("button", "delete-btn", "→ " + next[1]);
        move.type = "button";
        move.style.marginBottom = "6px";
        move.addEventListener("click", () => moveOrder(order, next[0], move));
        actionCell.append(move);
      }
      if (next || order.paymentStatus === "refund_failed") {
        const cancel = el("button", "delete-btn", order.orderStatus === "cancelled" ? "Retry refund" : "Cancel");
        cancel.type = "button";
        cancel.addEventListener("click", () => cancelAdminOrder(order, cancel));
        actionCell.append(cancel);
      }

      row.append(orderCell, customerCell, el("td", "", formatMoney(order.grandTotal)), statusCell, actionCell);
      return row;
    }));
  } catch (error) {
    messageRow(ordersBody, error.message);
  }
}

async function moveOrder(order, status, button) {
  button.disabled = true;
  try {
    const data = await apiFetch(`/orders/${order._id}/status`, { method: "PATCH", body: { status } });
    showToast(data.message || "Order updated");
  } catch (error) {
    showToast(error.message, true);
  }
  loadAdminOrders();
}

async function cancelAdminOrder(order, button) {
  if (!confirm(`Cancel ${order.orderNumber}? The customer will be refunded.`)) return;
  button.disabled = true;
  try {
    const data = await apiFetch(`/orders/${order._id}/cancel`, { method: "PATCH", body: { reason: "Cancelled by admin" } });
    showToast(data.message || "Order cancelled");
  } catch (error) {
    showToast(error.message, true);
  }
  loadAdminOrders();
}

if (adminUser) {
  loadUsers();
  loadAdminOrders();
}
