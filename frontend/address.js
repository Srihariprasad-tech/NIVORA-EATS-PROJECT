// =====================================================
// My Addresses page
// GET    /address              -> { gett: [...] }
// POST   /address/create       -> { add }
// PATCH  /address/:id          -> { address }
// PATCH  /address/:id/default
// DELETE /address/:id
// =====================================================

const addressUser = requireLogin(["customer"]);

const addressGrid = document.getElementById("address-grid");
const addressCount = document.getElementById("address-count");
const addressMessage = document.getElementById("address-message");
const addressForm = document.getElementById("address-form");
const formTitle = document.getElementById("form-title");
const saveButton = document.getElementById("save-address");
const cancelEditButton = document.getElementById("cancel-edit");

// Came from checkout? Go back there after saving.
const returnTo = new URLSearchParams(location.search).get("from") === "checkout" ? "checkout.html" : null;

let addresses = [];
let editingId = null;

const FIELDS = ["fullName", "phoneNo", "addressLine", "landmark", "city", "state", "pincode", "addressType"];

function showAddressMessage(text, isError) {
  addressMessage.hidden = !text;
  addressMessage.textContent = text || "";
  addressMessage.style.color = isError ? "#a33a2a" : "#2e7d32";
}

async function loadAddresses() {
  try {
    const data = await apiFetch("/address");
    addresses = data.gett || [];
    renderAddresses();
  } catch (error) {
    addressGrid.replaceChildren(el("p", "subtitle", "Addresses could not be loaded."));
    showAddressMessage(error.message, true);
  }
}

function renderAddresses() {
  addressGrid.replaceChildren();
  addressCount.textContent = addresses.length;

  if (addresses.length === 0) {
    addressGrid.append(el("p", "subtitle", "No saved addresses yet. Add one below."));
    return;
  }

  // Default address first
  const sorted = [...addresses].sort((a, b) => (b.isDefault === true) - (a.isDefault === true));

  sorted.forEach(address => {
    const card = el("article", address.isDefault ? "address-card default-card" : "address-card");

    const top = el("div", "card-top");
    top.append(el("span", "address-icon", address.addressType === "work" ? "⌖" : "⌂"));
    if (address.isDefault) {
      top.append(el("span", "badge", "Default Address"));
    } else {
      const setDefault = el("button", "set-default", "Set as Default");
      setDefault.type = "button";
      setDefault.addEventListener("click", () => makeDefault(address._id));
      top.append(setDefault);
    }

    const type = address.addressType || "home";
    const text = el("p", "address-text");
    text.append(
      [address.addressLine, address.landmark].filter(Boolean).join(", "),
      el("br"),
      `${address.city}, ${address.state} - ${address.pincode}`
    );

    const actions = el("div", "card-actions");
    const edit = el("button", "btn btn-outline", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => startEdit(address));
    const remove = el("button", "btn btn-danger-outline", "Delete");
    remove.type = "button";
    remove.addEventListener("click", () => deleteAddress(address));
    actions.append(edit, remove);

    card.append(top, el("h3", "", type.charAt(0).toUpperCase() + type.slice(1)),
      el("p", "person", `${address.fullName} · ${address.phoneNo}`), text, actions);
    addressGrid.append(card);
  });
}

// Same rules as backend/src/models/address.js
function readForm() {
  const value = id => document.getElementById(id).value.trim();
  const data = {};
  FIELDS.forEach(id => (data[id] = value(id)));
  data.phoneNo = data.phoneNo.replace(/[\s-]/g, "");

  if (data.fullName.length < 4) return "Full name must be at least 4 characters.";
  if (!/^\+?\d{10,15}$/.test(data.phoneNo)) return "Enter a valid phone number (10 digits).";
  if (data.addressLine.length < 5) return "House / street must be at least 5 characters.";
  if (!data.landmark) return "Please add a landmark.";
  if (data.city.length < 2) return "Please enter the city.";
  if (data.state.length < 2) return "Please enter the state.";
  if (!/^\d{6}$/.test(data.pincode)) return "Pincode must be 6 digits.";
  return data;
}

addressForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = readForm();
  if (typeof data === "string") {
    showAddressMessage(data, true);
    return;
  }
  const makeDefaultChecked = document.getElementById("makeDefault").checked;

  saveButton.disabled = true;
  try {
    let saved;
    if (editingId) {
      const result = await apiFetch("/address/" + editingId, { method: "PATCH", body: data });
      saved = result.address;
    } else {
      const result = await apiFetch("/address/create", {
        method: "POST",
        body: makeDefaultChecked ? { ...data, isDefault: true } : data
      });
      saved = result.add;
    }
    if (editingId && makeDefaultChecked && saved && !saved.isDefault) {
      await apiFetch(`/address/${saved._id}/default`, { method: "PATCH" });
    }

    showToast(editingId ? "Address updated ✓" : "Address saved ✓");
    resetForm();
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }
    await loadAddresses();
    showAddressMessage("");
  } catch (error) {
    showAddressMessage(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

function startEdit(address) {
  editingId = address._id;
  FIELDS.forEach(id => (document.getElementById(id).value = address[id] || ""));
  document.getElementById("makeDefault").checked = address.isDefault === true;
  formTitle.textContent = "Edit Address";
  saveButton.textContent = "Update Address";
  cancelEditButton.hidden = false;
  document.getElementById("add-address").scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  addressForm.reset();
  document.getElementById("state").value = "Maharashtra";
  formTitle.textContent = "Add a New Address";
  saveButton.textContent = "Save Address";
  cancelEditButton.hidden = true;
}

cancelEditButton.addEventListener("click", resetForm);

async function makeDefault(id) {
  try {
    await apiFetch(`/address/${id}/default`, { method: "PATCH" });
    showToast("Default address updated ✓");
    loadAddresses();
  } catch (error) {
    showToast(error.message, true);
  }
}

async function deleteAddress(address) {
  if (!confirm("Delete this address?")) return;
  try {
    await apiFetch("/address/" + address._id, { method: "DELETE" });
    showToast("Address deleted");
    // If the default was deleted, make another one default so checkout keeps working
    const remaining = addresses.filter(a => a._id !== address._id);
    if (address.isDefault && remaining.length > 0) {
      await apiFetch(`/address/${remaining[0]._id}/default`, { method: "PATCH" });
    }
    loadAddresses();
  } catch (error) {
    showToast(error.message, true);
  }
}

if (addressUser) {
  loadAddresses();
}
