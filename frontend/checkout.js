// =====================================================
// Checkout page
// GET  /address           -> saved addresses   (response key: gett)
// GET  /checkout          -> cart summary      (response key: totalcartval)
// POST /payment/createorder -> Razorpay order  (response key: pay)
// Razorpay popup -> POST /payment/verify -> POST /orders { addressId, paymentId }
// =====================================================

const currentUser = requireLogin();

const addressList = document.getElementById("address-list");
const cartItems = document.getElementById("cart-items");
const pageMessage = document.getElementById("page-message");
const orderMessage = document.getElementById("order-message");
const placeOrderButton = document.getElementById("place-order");

let checkoutData = null;
let savedAddresses = [];
let selectedAddressId = null;
let verifiedPaymentId = null; // kept so "Try again" can finish an order after a successful payment

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showPageMessage(message, isError = false) {
  pageMessage.hidden = !message;
  pageMessage.textContent = message;
  pageMessage.className = isError ? "message error" : "message";
}

function showOrderMessage(message, isError = false) {
  orderMessage.textContent = message;
  orderMessage.className = isError ? "order-message error" : "order-message success";
}

function updateButton() {
  const hasItems = checkoutData && checkoutData.items && checkoutData.items.length > 0;
  placeOrderButton.disabled = !hasItems || !selectedAddressId;
}

// ---------- Load page ----------
async function loadCheckout() {
  showPageMessage("Loading checkout details...");

  // 1) Addresses
  try {
    const addressData = await apiFetch("/address");
    savedAddresses = addressData.gett || [];
  } catch (error) {
    showPageMessage(error.message, true);
    savedAddresses = [];
  }

  const defaultAddress = savedAddresses.find(a => a.isDefault === true);
  selectedAddressId = defaultAddress ? defaultAddress._id : (savedAddresses[0] ? savedAddresses[0]._id : null);
  renderAddresses();

  // 2) Cart summary
  try {
    const data = await apiFetch("/checkout");
    checkoutData = data.totalcartval;
    renderCart(checkoutData.items);
    renderBill(checkoutData);
    showPageMessage("");
  } catch (error) {
    checkoutData = null;
    renderBill({ subtotal: 0, deliveryfee: 0, grandtotal: 0 });
    const text = error.message.toLowerCase();

    if (text.includes("cart")) {
      // "cart not found on this user" / "cart is empty"
      renderEmptyCart();
      showPageMessage("");
    } else if (text.includes("default address")) {
      cartItems.replaceChildren(makeElement("p", "muted", "Add a delivery address to see your order summary."));
      showPageMessage("Please add a delivery address first.", true);
    } else if (text.includes("food not found")) {
      cartItems.replaceChildren(makeElement("p", "muted", "A dish in your cart is no longer on the menu."));
      showPageMessage("One of the dishes in your cart was removed by the cook. Please remove it from your cart.", true);
    } else {
      cartItems.replaceChildren(makeElement("p", "muted", "Cart details could not be loaded."));
      showPageMessage(error.message, true);
    }
  }

  updateButton();
}

// ---------- Render ----------
function renderAddresses() {
  addressList.replaceChildren();

  if (savedAddresses.length === 0) {
    addressList.append(makeElement("p", "muted", "No saved addresses yet. Add one to continue."));
    return;
  }

  savedAddresses.forEach(address => {
    const label = makeElement("label", "address-option");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "deliveryAddress";
    radio.value = address._id;
    radio.checked = String(address._id) === String(selectedAddressId);
    radio.addEventListener("change", () => {
      selectedAddressId = address._id;
      showOrderMessage("");
      updateButton();
    });

    const content = makeElement("div", "address-content");
    const titleRow = makeElement("div", "address-title");
    const type = address.addressType || "home";
    titleRow.append(makeElement("strong", "", type.charAt(0).toUpperCase() + type.slice(1)));

    if (address.isDefault === true) {
      titleRow.append(makeElement("span", "default-badge", "Default"));
    }

    const line1 = [address.addressLine, address.landmark].filter(Boolean).join(", ");
    const line2 = [address.city, address.state].filter(Boolean).join(", ") +
      (address.pincode ? " - " + address.pincode : "");

    content.append(
      titleRow,
      makeElement("p", "", `${address.fullName || ""}${address.phoneNo ? " · " + address.phoneNo : ""}`),
      makeElement("p", "muted", line1),
      makeElement("p", "muted", line2)
    );

    label.append(radio, content);
    addressList.append(label);
  });
}

function renderEmptyCart() {
  cartItems.replaceChildren();
  const box = makeElement("div", "");
  box.append(makeElement("p", "muted", "Your cart is empty."));
  const link = makeElement("a", "text-link", "Browse homemade food →");
  link.href = "food-list-page.html";
  box.append(link);
  cartItems.append(box);
}

function renderCart(items) {
  cartItems.replaceChildren();

  if (!items || items.length === 0) {
    renderEmptyCart();
    return;
  }

  items.forEach(item => {
    const row = makeElement("article", "food-item");
    const info = makeElement("div", "food-info");

    info.append(
      makeElement("h3", "", item.name || "Food item"),
      makeElement("p", "", `${formatMoney(item.price)} × ${item.quantity}`)
    );

    row.append(
      makeElement("div", "food-icon", "🍲"),
      info,
      makeElement("strong", "food-price", formatMoney(item.itemtotal))
    );

    cartItems.append(row);
  });
}

function renderBill(data) {
  document.getElementById("item-total").textContent = formatMoney(data.subtotal);
  document.getElementById("delivery-fee").textContent = formatMoney(data.deliveryfee);
  document.getElementById("grand-total").textContent = formatMoney(data.grandtotal);
  placeOrderButton.textContent = data.grandtotal
    ? `Pay & Place Order · ${formatMoney(data.grandtotal)}`
    : "Place Order";
}

// ---------- Place order ----------
async function createOrderAfterPayment(paymentId) {
  showOrderMessage("Payment successful. Creating your order...");

  const result = await apiFetch("/orders", {
    method: "POST",
    body: { addressId: selectedAddressId, paymentId }
  });

  verifiedPaymentId = null;
  showOrderMessage(`Order ${result.order.orderNumber} placed successfully!`);
  setTimeout(() => {
    window.location.href = "orders.html";
  }, 1200);
}

function finishWithError(message) {
  showOrderMessage(message, true);
  placeOrderButton.disabled = false;
}

placeOrderButton.addEventListener("click", async () => {
  if (!selectedAddressId) {
    showOrderMessage("Please select a delivery address.", true);
    return;
  }

  placeOrderButton.disabled = true;

  // Payment already went through earlier but the order failed -> just retry the order
  if (verifiedPaymentId) {
    try {
      await createOrderAfterPayment(verifiedPaymentId);
    } catch (error) {
      finishWithError(`${error.message} Your payment is safe. Press the button to try again.`);
    }
    return;
  }

  if (typeof Razorpay === "undefined") {
    finishWithError("Payment system could not load. Please check your internet and refresh the page.");
    return;
  }

  showOrderMessage("Starting payment...");

  let pay;
  try {
    const data = await apiFetch("/payment/createorder", { method: "POST" });
    pay = data.pay;
  } catch (error) {
    finishWithError(error.message);
    return;
  }

  const razorpay = new Razorpay({
    key: pay.keyid,
    amount: pay.amount,
    currency: pay.currency,
    order_id: pay.razorpayOrderId,
    name: "Nivora Eats",
    description: "Homemade food order",
    prefill: {
      name: currentUser ? currentUser.name : "",
      email: currentUser ? currentUser.email : "",
      contact: currentUser ? currentUser.phone : ""
    },
    theme: { color: "#2F3E2E" },

    handler: async function (response) {
      // 1) Check the payment on our backend
      try {
        showOrderMessage("Confirming your payment...");
        await apiFetch("/payment/verify", {
          method: "POST",
          body: {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature
          }
        });
      } catch (error) {
        finishWithError(
          `We could not confirm your payment (${error.message}). If money was deducted, contact support with payment ID ${response.razorpay_payment_id}.`
        );
        return;
      }

      // 2) Create the order
      verifiedPaymentId = pay.paymentid;
      try {
        await createOrderAfterPayment(pay.paymentid);
      } catch (error) {
        placeOrderButton.textContent = "Try placing order again";
        finishWithError(`${error.message} Your payment is safe. Press the button to try again.`);
      }
    },

    modal: {
      ondismiss: function () {
        finishWithError("Payment cancelled. You can try again.");
      }
    }
  });

  razorpay.on("payment.failed", function (response) {
    finishWithError(`Payment failed: ${response.error.description}`);
  });

  showOrderMessage("");
  razorpay.open();
});

if (currentUser) {
  loadCheckout();
}
