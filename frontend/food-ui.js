// =====================================================
// Shared food card + "View Details" pop-up
// Used by: food-list-page.html, cook-profile.html, index.html
// GET /food/:id            -> { getid }
// GET /reviews/food/:id    -> { food, reviews }
// =====================================================

function starText(rating) {
  const full = Math.round(Number(rating) || 0);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

// Card in the same design as the original food list page
function buildFoodCard(food, options = {}) {
  const card = el("article", "food-card");

  const imageBox = el("div", "food-image");
  const img = el("img");
  img.src = foodImage(food);
  img.alt = food.name;
  img.loading = "lazy";
  imageBox.append(img);
  if (food.isAvailable === false) {
    imageBox.append(el("span", "food-tag", "Sold out"));
  } else if (food.reviewCount >= 5 && food.averageRating >= 4.5) {
    imageBox.append(el("span", "food-tag", "Popular"));
  }

  const content = el("div", "food-content");

  const titleRow = el("div", options.titleRowClass || "food-title-row");
  titleRow.append(el("h3", "", food.name), el("span", "price", "₹" + food.price));

  const description = el("p", "food-description", food.shortDescription || food.description);

  const meta = el("div", "food-meta");
  const rating = el("span");
  rating.innerHTML = '<i class="fa-solid fa-star"></i> ';
  rating.append(food.reviewCount ? String(food.averageRating) : "New");
  const type = el("span");
  type.innerHTML = '<i class="fa-solid fa-leaf"></i> ';
  type.append(food.foodType === "non-veg" ? "Non-Veg" : "Veg");
  meta.append(rating, type);

  content.append(titleRow, description, meta);

  if (options.showCook !== false && food.cook) {
    const cook = el("div", "cook-info");
    cook.innerHTML = '<i class="fa-solid fa-house"></i> ';
    const link = el("a", "", "Homemade by a local cook");
    link.href = "cook-profile.html?id=" + encodeURIComponent(food.cook._id || food.cook);
    link.style.color = "inherit";
    cook.append(link);
    content.append(cook);
  }

  const viewButton = el("button", "view-btn", "View Details ");
  viewButton.type = "button";
  viewButton.innerHTML += '<i class="fa-solid fa-arrow-right"></i>';
  viewButton.addEventListener("click", () => openFoodDetails(food._id));
  content.append(viewButton);

  card.append(imageBox, content);
  return card;
}

function closeFoodDetails() {
  const backdrop = document.getElementById("nv-food-modal");
  if (backdrop) backdrop.remove();
  document.body.style.overflow = "";
}

async function openFoodDetails(foodId) {
  closeFoodDetails();

  const backdrop = el("div", "nv-modal-backdrop");
  backdrop.id = "nv-food-modal";
  const modal = el("div", "nv-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const closeButton = el("button", "nv-modal-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  closeButton.addEventListener("click", closeFoodDetails);
  const body = el("div", "nv-modal-body", "Loading dish...");
  modal.append(closeButton, body);
  backdrop.append(modal);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeFoodDetails();
  });
  document.addEventListener("keydown", function onKey(event) {
    if (event.key === "Escape") {
      closeFoodDetails();
      document.removeEventListener("keydown", onKey);
    }
  });
  document.body.append(backdrop);
  document.body.style.overflow = "hidden";

  let food;
  try {
    const data = await apiFetch("/food/" + encodeURIComponent(foodId));
    food = data.getid;
    if (!food || food.isActive === false) throw new Error("This dish is no longer available.");
  } catch (error) {
    body.textContent = error.message;
    return;
  }

  const img = el("img", "nv-modal-img");
  img.src = foodImage(food);
  img.alt = food.name;
  modal.insertBefore(img, body);

  body.replaceChildren();

  const title = el("div", "nv-modal-title");
  title.append(el("h2", "", food.name), el("span", "nv-modal-price", "₹" + food.price));

  const chips = el("div", "nv-chips");
  chips.append(el("span", "nv-chip " + (food.foodType === "non-veg" ? "nv-chip-nonveg" : "nv-chip-veg"),
    food.foodType === "non-veg" ? "● Non-Veg" : "● Veg"));
  [food.cuisine, food.category, food.spiceLevel && food.spiceLevel.replace("-", " ")].filter(Boolean)
    .forEach(text => chips.append(el("span", "nv-chip", text)));
  chips.append(el("span", "nv-chip",
    food.reviewCount ? `★ ${food.averageRating} (${food.reviewCount})` : "★ New"));

  const description = el("p", "", food.description);

  const facts = el("div", "nv-facts");
  [
    ["Serving size", food.servingSize],
    ["Ready in", food.preparationTime ? food.preparationTime + " min" : ""],
    ["Region", food.region],
    ["Ingredients", (food.ingredients || []).join(", ")]
  ].filter(([, value]) => value).forEach(([label, value]) => {
    const fact = el("div", "nv-fact");
    fact.append(el("strong", "", label), value);
    facts.append(fact);
  });

  body.append(title, chips, description, facts);

  // Buy row (customers and guests)
  const user = getToken() ? getUser() : null;
  const buyRow = el("div", "nv-buy-row");
  if (!user || user.role === "customer") {
    let quantity = 1;
    const qty = el("div", "nv-qty");
    const minus = el("button", "", "−");
    const count = el("span", "", "1");
    const plus = el("button", "", "+");
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", "Less");
    plus.setAttribute("aria-label", "More");
    minus.addEventListener("click", () => { quantity = Math.max(1, quantity - 1); count.textContent = quantity; });
    plus.addEventListener("click", () => { quantity = Math.min(20, quantity + 1); count.textContent = quantity; });
    qty.append(minus, count, plus);

    const add = el("button", "nv-btn", food.isAvailable === false ? "Sold out" : "Add to Cart");
    add.type = "button";
    add.disabled = food.isAvailable === false;
    add.addEventListener("click", async () => {
      add.disabled = true;
      const ok = await addToCart(food._id, quantity);
      add.disabled = false;
      if (ok) {
        add.textContent = "Added ✓";
        setTimeout(() => (add.textContent = "Add to Cart"), 1500);
      }
    });

    const goCart = el("a", "nv-btn nv-btn-light", "Go to Cart");
    goCart.href = "cart.html";
    buyRow.append(qty, add, goCart);
  } else {
    buyRow.append(el("p", "nv-muted", "Log in as a customer to order this dish."));
  }
  body.append(buyRow);

  const cookLink = el("a", "nv-link", "More dishes from this cook →");
  cookLink.href = "cook-profile.html?id=" + encodeURIComponent(food.cook);
  body.append(cookLink);

  // Reviews
  const reviewsBox = el("div", "nv-reviews");
  reviewsBox.append(el("h3", "", "Reviews"));
  const reviewsList = el("div", "", "Loading reviews...");
  reviewsBox.append(reviewsList);
  body.append(reviewsBox);

  try {
    const data = await apiFetch(`/reviews/food/${encodeURIComponent(food._id)}?limit=5`);
    reviewsList.replaceChildren();
    if (!data.reviews || data.reviews.length === 0) {
      reviewsList.append(el("p", "nv-muted", "No reviews yet. Order it and be the first to review!"));
    } else {
      data.reviews.forEach(review => {
        const row = el("div", "nv-review");
        const head = el("div");
        head.append(el("span", "nv-stars", starText(review.rating)), " ",
          el("strong", "", review.user && review.user.name ? review.user.name : "Customer"));
        row.append(head);
        if (review.comment) row.append(el("p", "", review.comment));
        reviewsList.append(row);
      });
    }
  } catch (error) {
    reviewsList.textContent = "Reviews could not be loaded.";
  }
}
