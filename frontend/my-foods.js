// =====================================================
// My Foods (cook dashboard)
// GET    /food/myfoods               -> { fd: [...] }
// PATCH  /food/:id/avaliablity       { isAvailable }
// DELETE /food/:id
// =====================================================

const myFoodsUser = requireLogin(["cook"]);

const myFoodGrid = document.getElementById("my-food-grid");
let myFoods = [];

function updateStats() {
  const active = myFoods.filter(food => food.isActive !== false);
  const available = active.filter(food => food.isAvailable !== false).length;
  document.getElementById("stat-total").textContent = active.length;
  document.getElementById("stat-available").textContent = available;
  document.getElementById("stat-unavailable").textContent = active.length - available;
}

function buildMyFoodCard(food) {
  const card = el("div", "food-card");

  const imageBox = el("div", "food-image");
  const img = el("img");
  img.src = foodImage(food);
  img.alt = food.name;
  img.loading = "lazy";
  const badge = el("span", "status-badge " + (food.isAvailable === false ? "unavailable" : "available"),
    food.isAvailable === false ? "Unavailable" : "Available");
  imageBox.append(img, badge);

  const content = el("div", "food-content");
  const titleRow = el("div", "food-title-row");
  titleRow.append(el("h3", "", food.name), el("span", "price", "₹" + food.price));

  const details = el("div", "quantity");
  details.innerHTML = '<i class="fa-solid fa-clock"></i> ';
  details.append(`${food.preparationTime} min · ${food.servingSize} · ★ ${food.reviewCount ? food.averageRating : "New"}`);

  const actions = el("div", "food-actions");
  const edit = el("button", "edit-btn");
  edit.type = "button";
  edit.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
  edit.addEventListener("click", () => (window.location.href = "cook-dashboard.html?id=" + food._id));
  const remove = el("button", "delete-btn");
  remove.type = "button";
  remove.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
  remove.addEventListener("click", () => deleteFood(food));
  actions.append(edit, remove);

  const availability = el("div", "availability");
  const label = el("label", "switch");
  const checkbox = el("input");
  checkbox.type = "checkbox";
  checkbox.checked = food.isAvailable !== false;
  checkbox.setAttribute("aria-label", "Available for orders");
  checkbox.addEventListener("change", () => toggleAvailability(food, checkbox, badge));
  label.append(checkbox, el("span", "slider"));
  availability.append(el("span", "", "Availability"), label);

  content.append(titleRow, el("p", "food-description", food.shortDescription || food.description), details, actions, availability);
  card.append(imageBox, content);
  return card;
}

function renderMyFoods() {
  myFoodGrid.replaceChildren();
  updateStats();

  const active = myFoods.filter(food => food.isActive !== false);
  if (active.length === 0) {
    const box = el("div", "nv-empty");
    box.append(el("h3", "", "No dishes yet"), el("p", "", "Add your first homemade dish to start getting orders."));
    const add = el("a", "nv-btn", "+ Add a Dish");
    add.href = "cook-dashboard.html";
    box.append(add);
    myFoodGrid.append(box);
    return;
  }
  active.forEach(food => myFoodGrid.append(buildMyFoodCard(food)));
}

async function loadMyFoods() {
  try {
    const data = await apiFetch("/food/myfoods");
    myFoods = data.fd || [];
    renderMyFoods();
  } catch (error) {
    myFoodGrid.replaceChildren(el("p", "nv-empty", error.message));
  }
}

async function toggleAvailability(food, checkbox, badge) {
  const isAvailable = checkbox.checked;
  checkbox.disabled = true;
  try {
    await apiFetch(`/food/${food._id}/avaliablity`, { method: "PATCH", body: { isAvailable } });
    food.isAvailable = isAvailable;
    badge.textContent = isAvailable ? "Available" : "Unavailable";
    badge.className = "status-badge " + (isAvailable ? "available" : "unavailable");
    updateStats();
    showToast(isAvailable ? "Dish is now available" : "Dish marked unavailable");
  } catch (error) {
    checkbox.checked = !isAvailable;
    showToast(error.message, true);
  } finally {
    checkbox.disabled = false;
  }
}

async function deleteFood(food) {
  if (!confirm(`Delete "${food.name}"? This cannot be undone.`)) return;
  try {
    await apiFetch("/food/" + food._id, { method: "DELETE" });
    myFoods = myFoods.filter(f => f._id !== food._id);
    renderMyFoods();
    showToast("Dish deleted");
  } catch (error) {
    showToast(error.message, true);
  }
}

if (myFoodsUser) {
  if (myFoodsUser.name) {
    document.getElementById("welcome-text").textContent = `Welcome, ${myFoodsUser.name.split(" ")[0]}!`;
  }
  loadMyFoods();
}
