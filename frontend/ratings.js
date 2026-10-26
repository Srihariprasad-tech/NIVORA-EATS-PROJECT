// =====================================================
// Reviews & Ratings page (ratings.html?foodId=...)
// GET   /orders                 -> delivered dishes you can review
// GET   /reviews/food/:foodId   -> { food: { averageRating, reviewCount, breakdown }, reviews }
// POST  /reviews                { foodId, rating, comment }
// PATCH /reviews/:id            { rating, comment }  (if you already reviewed it)
// =====================================================

const ratingsUser = requireLogin(["customer"]);

const foodSelect = document.getElementById("food");
const reviewForm = document.getElementById("review-form");
const reviewMessage = document.getElementById("review-message");
const reviewsList = document.getElementById("reviews-list");
const submitButton = reviewForm.querySelector('button[type="submit"]');

let currentReviews = [];

function showReviewMessage(text, isError) {
  reviewMessage.textContent = text;
  reviewMessage.style.color = isError ? "#a33a2a" : "#2e7d32";
}

function stars(rating) {
  const full = Math.round(Number(rating) || 0);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

async function loadDeliveredDishes() {
  try {
    const data = await apiFetch("/orders");
    const dishes = new Map();
    (data.orders || [])
      .filter(order => order.orderStatus === "delivered")
      .forEach(order => order.items.forEach(item => dishes.set(String(item.food), item.foodName)));

    foodSelect.replaceChildren();
    if (dishes.size === 0) {
      foodSelect.append(new Option("No delivered dishes yet", ""));
      submitButton.disabled = true;
      showReviewMessage("You can review a dish after it has been delivered to you.", false);
      return;
    }

    foodSelect.append(new Option("Choose a food item", ""));
    dishes.forEach((name, id) => foodSelect.append(new Option(name, id)));

    const wanted = new URLSearchParams(location.search).get("foodId");
    if (wanted && dishes.has(wanted)) {
      foodSelect.value = wanted;
    } else if (dishes.size === 1) {
      foodSelect.selectedIndex = 1;
    }
    if (foodSelect.value) loadReviews(foodSelect.value);
  } catch (error) {
    foodSelect.replaceChildren(new Option("Could not load your orders", ""));
    showReviewMessage(error.message, true);
  }
}

async function loadReviews(foodId) {
  reviewsList.replaceChildren(el("p", "review-description", "Loading reviews..."));
  try {
    const data = await apiFetch(`/reviews/food/${encodeURIComponent(foodId)}?limit=20`);
    const food = data.food;
    currentReviews = data.reviews || [];

    document.getElementById("summary-title").textContent = food.name;
    document.getElementById("avg-rating").textContent = food.reviewCount ? food.averageRating.toFixed(1) : "-";
    document.getElementById("avg-stars").textContent = stars(food.averageRating);
    document.getElementById("review-total").textContent =
      food.reviewCount ? `Based on ${food.reviewCount} review${food.reviewCount === 1 ? "" : "s"}` : "No reviews yet";
    [5, 4, 3, 2, 1].forEach(n => {
      const count = (food.breakdown && food.breakdown[n]) || 0;
      const percent = food.reviewCount ? Math.round((count / food.reviewCount) * 100) : 0;
      document.getElementById("bar-" + n).style.width = percent + "%";
      document.getElementById("pct-" + n).textContent = percent + "%";
    });

    reviewsList.replaceChildren();
    if (currentReviews.length === 0) {
      reviewsList.append(el("p", "review-description", "No reviews yet. Be the first!"));
      return;
    }
    currentReviews.forEach(review => {
      const name = (review.user && review.user.name) || "Customer";
      const card = el("article", "review-card");
      const top = el("div", "review-top");
      const info = el("div", "reviewer-info");
      info.append(el("h3", "", name), el("p", "", "Ordered " + food.name));
      top.append(el("div", "avatar", name.charAt(0).toUpperCase()), info, el("span", "verified", "✓ Verified order"));
      card.append(top, el("div", "stars", stars(review.rating)));
      if (review.comment) card.append(el("p", "review-description", review.comment));
      card.append(el("p", "review-date", new Date(review.createdAt).toLocaleDateString("en-IN",
        { day: "numeric", month: "short", year: "numeric" }) + (review.isEdited ? " · edited" : "")));
      reviewsList.append(card);
    });
  } catch (error) {
    reviewsList.replaceChildren(el("p", "review-description", error.message));
  }
}

foodSelect.addEventListener("change", () => {
  showReviewMessage("", false);
  if (foodSelect.value) loadReviews(foodSelect.value);
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const foodId = foodSelect.value;
  const checked = reviewForm.querySelector('input[name="rating"]:checked');
  const title = document.getElementById("review-title").value.trim();
  const text = document.getElementById("review-text").value.trim();

  if (!foodId) return showReviewMessage("Please choose a dish.", true);
  if (!checked) return showReviewMessage("Please choose a star rating.", true);

  const rating = Number(checked.value);
  const comment = [title, text].filter(Boolean).join(" - ").slice(0, 1000);

  submitButton.disabled = true;
  try {
    await apiFetch("/reviews", { method: "POST", body: { foodId, rating, comment } });
    showReviewMessage("Thank you! Your review is posted.", false);
    reviewForm.reset();
    foodSelect.value = foodId;
  } catch (error) {
    if (error.status === 409) {
      // Already reviewed -> update the existing review instead
      const mine = currentReviews.find(review => review.user && String(review.user._id) === String(ratingsUser._id));
      if (mine) {
        try {
          // Keep the old comment if nothing new was typed
          const update = comment ? { rating, comment } : { rating };
          await apiFetch("/reviews/" + mine._id, { method: "PATCH", body: update });
          showReviewMessage("Your earlier review was updated.", false);
        } catch (updateError) {
          showReviewMessage(updateError.message, true);
        }
      } else {
        showReviewMessage(error.message, true);
      }
    } else {
      showReviewMessage(error.message, true);
    }
  } finally {
    submitButton.disabled = false;
  }
  loadReviews(foodId);
});

if (ratingsUser) {
  loadDeliveredDishes();
}
