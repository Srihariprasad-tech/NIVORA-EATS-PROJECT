// =====================================================
// Profile page: details saved at login (POST /auth/login returns the user)
// GET /users/profile checks the login is still valid
// =====================================================

const profileUser = requireLogin();

const ROLE_NAMES = { customer: "Customer", cook: "Home Cook", admin: "Admin", delivery: "Delivery Partner" };

const ACTIVITY = {
  customer: [
    ["fa-bag-shopping", "My Orders", "View your past and current orders.", "orders.html"],
    ["fa-location-dot", "My Addresses", "Manage your delivery addresses.", "address.html"],
    ["fa-star", "My Reviews", "Rate the food you received.", "ratings.html"]
  ],
  cook: [
    ["fa-utensils", "My Foods", "Manage your dishes and availability.", "my-foods.html"],
    ["fa-plus", "Add a Dish", "Put a new homemade dish on the menu.", "cook-dashboard.html"],
    ["fa-bag-shopping", "Orders", "Prepare and update your orders.", "orders.html"]
  ],
  admin: [
    ["fa-user-shield", "Admin Dashboard", "Manage users and orders.", "admin-dashboard.html"],
    ["fa-bowl-food", "Explore Food", "See the menu customers see.", "food-list-page.html"]
  ]
};

function fillProfile(user) {
  const role = ROLE_NAMES[user.role] || user.role;
  const set = (id, value) => (document.getElementById(id).textContent = value || "-");
  set("profile-name", user.name);
  set("profile-email", user.email);
  set("profile-role-badge", role);
  set("info-name", user.name);
  set("info-email", user.email);
  set("info-phone", user.phone ? "+91 " + user.phone.replace(/^\+91/, "") : "");
  set("info-role", role);

  const grid = document.getElementById("activity-grid");
  grid.replaceChildren();
  (ACTIVITY[user.role] || ACTIVITY.customer).forEach(([icon, title, text, href]) => {
    const card = el("a", "activity-card");
    card.href = href;
    const iconBox = el("div", "activity-icon");
    iconBox.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    const textBox = el("div");
    textBox.append(el("h3", "", title), el("p", "", text));
    const arrow = el("i", "fa-solid fa-arrow-right arrow-icon");
    card.append(iconBox, textBox, arrow);
    grid.append(card);
  });
}

document.getElementById("profile-logout").addEventListener("click", logout);

if (profileUser) {
  fillProfile(profileUser);
  // Confirms the token is still valid (expired -> login page)
  apiFetch("/users/profile").catch(() => {});
}
