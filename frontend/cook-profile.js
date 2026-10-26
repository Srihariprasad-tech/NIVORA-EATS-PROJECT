// =====================================================
// Cook profile: cook-profile.html?id=<cookId>
// GET /food/cook/:id -> { ck: [...] }
// =====================================================

const cookId = new URLSearchParams(location.search).get("id");
const cookGrid = document.getElementById("foodGrid");
const cookCount = document.getElementById("foodCount");
const cookNoResults = document.getElementById("noResults");
const cookSearch = document.getElementById("searchInput");
let cookFoods = [];

function renderCookFoods() {
  const text = cookSearch.value.toLowerCase().trim();
  const visible = cookFoods.filter(food => food.name.toLowerCase().includes(text));
  cookGrid.replaceChildren(...visible.map(food => buildFoodCard(food, { titleRowClass: "title-row", showCook: false })));
  cookCount.textContent = visible.length + (visible.length === 1 ? " dish" : " dishes");
  cookNoResults.style.display = visible.length === 0 ? "block" : "none";
}

async function loadCookProfile() {
  if (!cookId) {
    window.location.href = "food-list-page.html";
    return;
  }
  try {
    const data = await apiFetch("/food/cook/" + encodeURIComponent(cookId));
    cookFoods = (data.ck || []).filter(food => food.isActive !== false);

    const regions = [...new Set(cookFoods.map(food => food.region).filter(Boolean))];
    document.getElementById("cook-region").textContent = regions.join(", ") || "Maharashtra";
    const rated = cookFoods.filter(food => food.reviewCount > 0);
    const reviews = rated.reduce((sum, food) => sum + food.reviewCount, 0);
    const average = reviews ? rated.reduce((sum, food) => sum + food.averageRating * food.reviewCount, 0) / reviews : 0;
    document.getElementById("cook-rating").textContent = reviews ? average.toFixed(1) + " Rating" : "New cook";
    document.getElementById("cook-dishes").textContent = cookFoods.length + (cookFoods.length === 1 ? " Dish" : " Dishes");

    renderCookFoods();
  } catch (error) {
    cookGrid.replaceChildren(el("p", "nv-empty", error.message));
    cookCount.textContent = "";
  }
}

cookSearch.addEventListener("input", renderCookFoods);
loadCookProfile();
