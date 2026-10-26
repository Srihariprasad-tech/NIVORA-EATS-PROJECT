// =====================================================
// Home page: search, buttons, and 4 real featured dishes
// GET /food/all?limit=8 -> { foods: { foods: [...] } }
// =====================================================

const homeSearchInput = document.querySelector(".search-input");
const homeSearchButton = document.querySelector(".search-button");
const featuredCards = document.querySelector(".featured-food_cards");

function goToFoodList(search) {
  window.location.href = "food-list-page.html" + (search ? "?search=" + encodeURIComponent(search) : "");
}

homeSearchButton.addEventListener("click", () => goToFoodList(homeSearchInput.value.trim()));
homeSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") goToFoodList(homeSearchInput.value.trim());
});
document.querySelector(".explore-menu").addEventListener("click", () => goToFoodList());
document.querySelector(".cta-button").addEventListener("click", () => goToFoodList());

// Until real dishes load (or if there are none yet), the sample cards open the menu
featuredCards.querySelectorAll(".add-button").forEach(button => {
  button.addEventListener("click", () => goToFoodList());
});

function buildHomeCard(food) {
  const card = el("div", "food-card");
  card.style.cursor = "pointer";

  const img = el("img", "food-img");
  img.src = foodImage(food);
  img.alt = food.name;
  img.loading = "lazy";

  const content = el("div", "card-content");
  const footer = el("div", "card-footer");
  const add = el("button", "add-button", food.isAvailable === false ? "Sold out" : " Add +");
  add.type = "button";
  add.disabled = food.isAvailable === false;
  add.addEventListener("click", (event) => {
    event.stopPropagation();
    addToCart(food._id, 1);
  });
  footer.append(el("p", "price", "₹" + food.price + (food.servingSize ? " (" + food.servingSize + ")" : "")), add);
  content.append(el("h1", "", food.name), el("p", "", food.shortDescription || food.description), footer);

  card.append(img, content);
  card.addEventListener("click", () => openFoodDetails(food._id));
  return card;
}

async function loadFeatured() {
  try {
    const data = await apiFetch("/food/all?limit=8");
    const foods = ((data.foods && data.foods.foods) || [])
      .filter(food => food.isActive !== false && food.isAvailable !== false)
      .slice(0, 4);
    if (foods.length === 0) return; // keep the sample cards
    featuredCards.replaceChildren(...foods.map(buildHomeCard));
  } catch (error) {
    // Server asleep or offline: keep the sample cards
  }
}

loadFeatured();
