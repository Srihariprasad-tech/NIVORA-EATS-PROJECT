// =====================================================
// Cart page
// GET    /cart/all            -> { carts: { items: [{ food, quantity, price }] } | null }
// GET    /food/:id            -> { getid }   (name + photo for each item)
// PATCH  /cart/:foodId        { quantity }
// DELETE /cart/delete/:foodId
// DELETE /cart/cartdelete
// =====================================================

const cartUser = requireLogin(["customer"]);

const DELIVERY_FEE = 40; // same as the backend (checkoutService / paymentService)

const cartList = document.getElementById("cart-list");
const cartMessage = document.getElementById("page-message");
const checkoutLink = document.getElementById("go-checkout");
const clearButton = document.getElementById("clear-cart");

let cartRows = []; // [{ foodId, quantity, food }]

function showCartMessage(text, isError) {
  cartMessage.hidden = !text;
  cartMessage.textContent = text || "";
  cartMessage.className = isError ? "message error" : "message";
}

function setCheckoutEnabled(enabled) {
  checkoutLink.style.pointerEvents = enabled ? "" : "none";
  checkoutLink.style.opacity = enabled ? "" : "0.5";
  checkoutLink.setAttribute("aria-disabled", String(!enabled));
}

async function loadCart() {
  showCartMessage("");
  try {
    const data = await apiFetch("/cart/all");
    const items = (data.carts && data.carts.items) || [];

    // Fetch each dish for its name, photo and current price
    cartRows = await Promise.all(items.map(async item => {
      let food = null;
      try {
        const foodData = await apiFetch("/food/" + item.food);
        food = foodData.getid;
      } catch (error) {
        food = null;
      }
      return { foodId: String(item.food), quantity: item.quantity, cartPrice: item.price, food };
    }));

    renderCart();
  } catch (error) {
    cartList.replaceChildren(el("p", "muted", "Cart could not be loaded."));
    showCartMessage(error.message, true);
    setCheckoutEnabled(false);
  }
}

function renderCart() {
  cartList.replaceChildren();

  if (cartRows.length === 0) {
    const box = el("div");
    box.append(el("p", "muted", "Your cart is empty."));
    const link = el("a", "text-link", "Browse homemade food →");
    link.href = "food-list-page.html";
    box.append(link);
    cartList.append(box);
    clearButton.hidden = true;
    renderBill(0);
    setCheckoutEnabled(false);
    refreshCartCount();
    return;
  }

  let subtotal = 0;
  let hasProblem = false;

  cartRows.forEach(row => {
    const food = row.food;
    const available = food && food.isActive !== false && food.isAvailable !== false;
    const price = food ? food.price : row.cartPrice;
    if (available) subtotal += price * row.quantity;
    else hasProblem = true;

    const line = el("article", "cart-row");
    const img = el("img");
    img.src = foodImage(food);
    img.alt = food ? food.name : "Dish";

    const info = el("div", "food-info");
    info.append(el("h3", "", food ? food.name : "Dish no longer on the menu"));
    info.append(el("p", "", available ? `${formatMoney(price)} each` : "Not available right now - please remove it"));

    const actions = el("div", "cart-actions");
    const qty = el("div", "nv-qty");
    const minus = el("button", "", "−");
    const count = el("span", "", String(row.quantity));
    const plus = el("button", "", "+");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", "Less");
    plus.setAttribute("aria-label", "More");
    minus.disabled = row.quantity <= 1 || !available;
    plus.disabled = row.quantity >= 20 || !available;
    minus.addEventListener("click", () => changeQuantity(row, row.quantity - 1));
    plus.addEventListener("click", () => changeQuantity(row, row.quantity + 1));
    qty.append(minus, count, plus);

    const remove = el("button", "remove-link", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => removeItem(row));

    actions.append(qty, el("strong", "food-price", available ? formatMoney(price * row.quantity) : "—"), remove);
    line.append(img, info, actions);
    cartList.append(line);
  });

  clearButton.hidden = false;
  renderBill(subtotal);
  setCheckoutEnabled(!hasProblem && subtotal > 0);
  if (hasProblem) showCartMessage("Some dishes are not available. Remove them to continue.", true);
  refreshCartCount();
}

function renderBill(subtotal) {
  document.getElementById("item-total").textContent = formatMoney(subtotal);
  document.getElementById("delivery-fee").textContent = formatMoney(subtotal ? DELIVERY_FEE : 0);
  document.getElementById("grand-total").textContent = formatMoney(subtotal ? subtotal + DELIVERY_FEE : 0);
}

async function changeQuantity(row, quantity) {
  if (quantity < 1 || quantity > 20) return;
  try {
    await apiFetch("/cart/" + row.foodId, { method: "PATCH", body: { quantity } });
    row.quantity = quantity;
    renderCart();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function removeItem(row) {
  try {
    await apiFetch("/cart/delete/" + row.foodId, { method: "DELETE" });
    cartRows = cartRows.filter(r => r !== row);
    renderCart();
    showToast("Removed from cart");
  } catch (error) {
    showToast(error.message, true);
  }
}

clearButton.addEventListener("click", async () => {
  if (!confirm("Remove all dishes from your cart?")) return;
  try {
    await apiFetch("/cart/cartdelete", { method: "DELETE" });
    cartRows = [];
    renderCart();
  } catch (error) {
    showToast(error.message, true);
  }
});

if (cartUser) {
  loadCart();
}
