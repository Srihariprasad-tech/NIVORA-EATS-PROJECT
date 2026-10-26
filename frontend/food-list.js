// =====================================================
// Explore Food page
// GET /food/all?search=&foodType=&cuisine=&sort=&page=&limit=
//   -> { foods: { foods: [...], total, page, limit, totalPages } }
// =====================================================

const foodGrid = document.getElementById("foodGrid");
const foodCount = document.getElementById("foodCount");
const noResults = document.getElementById("noResults");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const loadMoreButton = document.getElementById("loadMore");

const PAGE_SIZE = 12;
let currentPage = 1;
let totalPages = 1;
let requestNumber = 0;

// Search coming from the home page: food-list-page.html?search=misal
const startSearch = new URLSearchParams(location.search).get("search");
if (startSearch) searchInput.value = startSearch;

function buildQuery(page) {
  const params = new URLSearchParams({ page, limit: PAGE_SIZE });
  const search = searchInput.value.trim();
  if (search) params.set("search", search);

  const [key, value] = (categoryFilter.value || "").split(":");
  if (key && value) params.set(key, value);

  if (sortFilter.value) params.set("sort", sortFilter.value);
  return params.toString();
}

async function loadFoods(reset = true) {
  const myRequest = ++requestNumber;

  if (reset) {
    currentPage = 1;
    foodGrid.replaceChildren(el("p", "nv-empty", "Loading dishes..."));
    noResults.style.display = "none";
  }
  loadMoreButton.hidden = true;

  try {
    const data = await apiFetch("/food/all?" + buildQuery(currentPage));
    if (myRequest !== requestNumber) return; // a newer search started

    const result = data.foods || {};
    const foods = (result.foods || []).filter(food => food.isActive !== false);
    totalPages = result.totalPages || 1;

    if (reset) foodGrid.replaceChildren();
    foods.forEach(food => foodGrid.append(buildFoodCard(food)));

    const total = result.total || 0;
    foodCount.textContent = total + (total === 1 ? " dish" : " dishes");
    noResults.style.display = foodGrid.children.length === 0 ? "block" : "none";
    loadMoreButton.hidden = currentPage >= totalPages;
  } catch (error) {
    if (myRequest !== requestNumber) return;
    foodGrid.replaceChildren();
    const box = el("div", "nv-empty");
    box.append(el("h3", "", "Could not load dishes"), el("p", "", error.message));
    const retry = el("button", "nv-btn", "Try again");
    retry.type = "button";
    retry.addEventListener("click", () => loadFoods(true));
    box.append(retry);
    foodGrid.append(box);
    foodCount.textContent = "";
  }
}

let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadFoods(true), 400);
});
categoryFilter.addEventListener("change", () => loadFoods(true));
sortFilter.addEventListener("change", () => loadFoods(true));
loadMoreButton.addEventListener("click", () => {
  currentPage++;
  loadFoods(false);
});

loadFoods(true);
