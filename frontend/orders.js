// =====================================================
// My Orders page
// GET   /orders              -> { orders: [...] }
// PATCH /orders/:id/cancel   -> cancel + refund (only while "confirmed")
// POST  /cart                -> used by "Reorder"
// =====================================================

const ordersUser = requireLogin();

const ordersList = document.getElementById("orders-list");
const ordersMessage = document.getElementById("orders-message");
const filterTabs = document.getElementById("filter-tabs");

let allOrders = [];
let currentFilter = "all";

const STATUS_LABEL = {
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled"
};

const PAYMENT_LABEL = {
  refund_pending: "Refund in progress",
  refunded: "Refunded",
  refund_failed: "Refund failed - please contact support"
};

// How many tracking steps are finished for each status
// Steps: 0 Order placed, 1 Preparing, 2 On the way, 3 Delivered
const STEPS_DONE = {
  confirmed: 1,
  preparing: 1,
  ready: 2,
  out_for_delivery: 2,
  delivered: 4
};

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatDate(value) {
  const date = new Date(value);
  if (isNaN(date)) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(status) {
  if (status === "delivered") return "delivered";
  if (status === "cancelled") return "cancelled";
  return "preparing";
}

function matchesFilter(order) {
  if (currentFilter === "all") return true;
  if (currentFilter === "delivered") return order.orderStatus === "delivered";
  if (currentFilter === "cancelled") return order.orderStatus === "cancelled";
  return order.orderStatus !== "delivered" && order.orderStatus !== "cancelled";
}

// ---------- Load ----------
async function loadOrders() {
  ordersMessage.hidden = false;
  ordersMessage.textContent = "Loading your orders...";

  try {
    const data = await apiFetch("/orders");
    allOrders = data.orders || [];
    renderOrders();
  } catch (error) {
    ordersMessage.textContent = error.message;
  }
}

// ---------- Render ----------
function renderTracking(status) {
  const tracking = el("div", "tracking");
  const steps = ["Order placed", "Preparing", "On the way", "Delivered"];
  const done = STEPS_DONE[status] || 0;

  steps.forEach((name, index) => {
    let stepClass = "tracking-step";
    if (index < done) stepClass += " completed";
    else if (index === done) stepClass += " current";

    const step = el("div", stepClass);
    step.append(el("span", "", index < done ? "✓" : String(index + 1)), el("p", "", name));
    tracking.append(step);

    if (index < steps.length - 1) {
      tracking.append(el("div", index < done ?"tracking-line completed-line" : "tracking-line"));
    }
  });

  return tracking;
}

function renderOrderCard(order) {
  const card = el("article", "order-card");

  // Top: number, date, status
  const top = el("div", "order-top");
  const heading = el("div");
  heading.append(
    el("span", "order-label", "ORDER ID"),
    el("h3", "", order.orderNumber),
    el("p", "muted", "Placed on " + formatDate(order.placedAt || order.createdAt))
  );
  top.append(heading, el("span", "status " + statusClass(order.orderStatus), STATUS_LABEL[order.orderStatus] || order.orderStatus));
  card.append(top);

  // Items
  (order.items || []).forEach(item => {
    const row = el("div", "food-row");
    let picture;
    if (item.image) {
      picture = el("img", "food-placeholder");
      picture.src = item.image;
      picture.alt = item.foodName;
      picture.style.objectFit = "cover";
    } else {
      picture = el("div", "food-placeholder", "🍱");
    }
    const info = el("div", "food-info");
    info.append(el("h3", "", item.foodName), el("p", "", `Quantity: ${item.quantity}`));
    row.append(picture, info, el("strong", "", formatMoney(item.itemTotal)));
    card.append(row);
  });

  // Tracking / notes
  if (order.orderStatus === "delivered") {
    card.append(el("div", "delivery-note", "✓ Delivered successfully"));
  } else if (order.orderStatus !== "cancelled") {
    card.append(renderTracking(order.orderStatus));
  }

  // Bottom: total + buttons
  const bottom = el("div", "order-bottom");
  const total = el("p");
  if (order.orderStatus === "cancelled") {
    total.className = "muted";
    total.textContent = "Order cancelled" + (PAYMENT_LABEL[order.paymentStatus] ? " · " + PAYMENT_LABEL[order.paymentStatus] : "");
  } else {
    total.append("Total paid: ", el("strong", "", formatMoney(order.grandTotal)));
  }

  const buttons = el("div", "button-group");

  if (order.orderStatus === "confirmed") {
    const cancelButton = el("button", "btn btn-outline", "Cancel Order");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => cancelOrder(order, cancelButton));
    buttons.append(cancelButton);
  }

  if (order.orderStatus === "delivered") {
    const rate = el("a", "btn btn-primary", "Rate Order");
    const firstFood = order.items && order.items[0] ? order.items[0].food : "";
    rate.href = "ratings.html?foodId=" + encodeURIComponent(firstFood);
    buttons.append(rate);
  }

  if (order.orderStatus === "delivered" || order.orderStatus === "cancelled") {
    const reorderButton = el("button", "btn btn-outline", "Reorder");
    reorderButton.type = "button";
    reorderButton.addEventListener("click", () => reorder(order, reorderButton));
    buttons.append(reorderButton);
  }

  bottom.append(total, buttons);
  card.append(bottom);

  return card;
}

function renderOrders() {
  ordersList.replaceChildren();
  const visible = allOrders.filter(matchesFilter);

  if (allOrders.length === 0) {
    ordersMessage.hidden = false;
    ordersMessage.textContent = "You haven't placed any orders yet.";
    return;
  }

  if (visible.length === 0) {
    ordersMessage.hidden = false;
    ordersMessage.textContent = "No orders in this list.";
    return;
  }

  ordersMessage.hidden = true;
  visible.forEach(order => ordersList.append(renderOrderCard(order)));
}

// ---------- Actions ----------
async function cancelOrder(order, button) {
  if (!confirm(`Cancel order ${order.orderNumber}? Your money will be refunded.`)) return;

  button.disabled = true;
  button.textContent = "Cancelling...";

  try {
    const data = await apiFetch(`/orders/${order._id}/cancel`, {
      method: "PATCH",
      body: { reason: "Cancelled by customer" }
    });
    alert(data.message || "Order cancelled");
  } catch (error) {
    alert(error.message);
  }

  loadOrders();
}

async function reorder(order, button) {
  button.disabled = true;
  button.textContent = "Adding...";

  let added = 0;
  const failed = [];

  for (const item of order.items || []) {
    try {
      await apiFetch("/cart", { method: "POST", body: { foodId: item.food, quantity: item.quantity } });
      added++;
    } catch (error) {
      failed.push(item.foodName);
    }
  }

  if (added > 0) {
    if (failed.length) alert("These dishes are not available right now: " + failed.join(", "));
    window.location.href = "checkout.html";
  } else {
    alert("These dishes are not available right now.");
    button.disabled = false;
    button.textContent = "Reorder";
  }
}

// ---------- Filter tabs ----------
filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;

  filterTabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  currentFilter = button.dataset.filter;
  renderOrders();
});

if (ordersUser) {
  loadOrders();
}
