// =====================================================
// Nivora Eats - shared API helper (include on every page that talks to the backend)
// =====================================================

// 1) Backend URL
//    LIVE: put your Render backend address here (no "/" at the end).
const BACKEND_URL = "https://nivora-eats-project.onrender.com";

//    TESTING on your computer (Live Server, localhost, or opening the file)
//    automatically uses your local backend instead.
const IS_LOCAL =
  location.protocol === "file:" ||
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const API_BASE = IS_LOCAL ? "http://localhost:3000" : BACKEND_URL.replace(/\/$/, "");

// 2) Cloudinary (food photo uploads from the cook dashboard)
//    Cloudinary -> Settings -> Upload -> Upload presets -> Add preset -> Signing mode: Unsigned
//    Put your cloud name and the preset name here.
const CLOUDINARY_CLOUD_NAME = "fyqrskrw";              // your Cloud name
const CLOUDINARY_UPLOAD_PRESET = "nivora_eats_unsigned"; // your preset name

// 3) Login session (token + user) saved in the browser
function getToken() {
  return localStorage.getItem("token");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch (error) {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// 4) Call the backend. Adds the token, sends JSON, and throws an Error
//    with the backend's message when the request fails.
//    options.noRedirect = true -> don't jump to login on 401 (used for small background calls)
async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: options.method || "GET",
      headers,
      body
    });
  } catch (error) {
    throw new Error("Cannot reach the server. Please check your internet or try again in a minute.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  // Token missing or expired -> go to login (except on the login call itself)
  if (response.status === 401 && path !== "/auth/login") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (!options.noRedirect) {
      window.location.href = "login.html";
    }
    throw new Error("Please log in again.");
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }

  return data;
}

// 5) Protect a page: requireLogin() or requireLogin(["cook"])
function requireLogin(allowedRoles) {
  const user = getUser();

  if (!getToken() || !user) {
    window.location.href = "login.html";
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = homePageFor(user.role);
    return null;
  }

  return user;
}

// Where each role lands after login
function homePageFor(role) {
  if (role === "cook") return "my-foods.html";
  if (role === "admin") return "admin-dashboard.html";
  return "food-list-page.html";
}

// Format money as ₹120.00
function formatMoney(value) {
  return "₹" + Number(value || 0).toFixed(2);
}

// Small helper to build elements safely (text is never treated as HTML)
function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

// First image of a food, or a local placeholder
function foodImage(food) {
  return (food && food.images && food.images[0] && food.images[0].url) || "homemade-thali.jpeg";
}

// Short pop-up message at the bottom of the screen
function showToast(message, isError = false) {
  let toast = document.getElementById("nv-toast");
  if (!toast) {
    toast = el("div", "nv-toast");
    toast.id = "nv-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("nv-toast-error", isError);
  toast.classList.add("nv-toast-show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("nv-toast-show"), 3000);
}

// 6) Cart helpers
async function addToCart(foodId, quantity = 1) {
  const user = getUser();
  if (!getToken() || !user) {
    window.location.href = "login.html";
    return false;
  }
  if (user.role !== "customer") {
    showToast("Only customer accounts can order food.", true);
    return false;
  }
  try {
    await apiFetch("/cart", { method: "POST", body: { foodId, quantity } });
    showToast("Added to cart ✓");
    refreshCartCount();
    return true;
  } catch (error) {
    showToast(error.message, true);
    return false;
  }
}

async function refreshCartCount() {
  const badge = document.getElementById("nv-cart-count");
  if (!badge) return;
  try {
    const data = await apiFetch("/cart/all", { noRedirect: true });
    const items = (data.carts && data.carts.items) || [];
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count ? ` (${count})` : "";
  } catch (error) {
    badge.textContent = "";
  }
}

// 7) Navbar: same working links on every page, based on who is logged in
const NAV_LINKS = {
  guest: [
    ["Home", "index.html"],
    ["Explore Food", "food-list-page.html"],
    ["Cart", "cart.html"],
    ["Login", "login.html"],
    ["Sign Up", "sign-up.html"]
  ],
  customer: [
    ["Home", "index.html"],
    ["Explore Food", "food-list-page.html"],
    ["Cart", "cart.html"],
    ["My Orders", "orders.html"],
    ["Addresses", "address.html"],
    ["Profile", "user-profile.html"]
  ],
  cook: [
    ["Home", "index.html"],
    ["My Foods", "my-foods.html"],
    ["Add Dish", "cook-dashboard.html"],
    ["Orders", "orders.html"],
    ["Profile", "user-profile.html"]
  ],
  admin: [
    ["Home", "index.html"],
    ["Dashboard", "admin-dashboard.html"],
    ["Explore Food", "food-list-page.html"],
    ["Profile", "user-profile.html"]
  ]
};

function setupNavbar() {
  const container =
    document.querySelector(".navbar .nav-links") ||
    document.querySelector("header nav") ||
    document.querySelector(".navbar nav");
  if (!container) return;

  const user = getToken() ? getUser() : null;
  const role = user ? user.role : "guest";
  const links = NAV_LINKS[role] || NAV_LINKS.guest;
  const currentPage = location.pathname.split("/").pop() || "index.html";
  const authButtons = document.querySelector(".auth-buttons"); // home page has its own Login / Sign Up buttons

  container.replaceChildren();

  links.forEach(([label, href]) => {
    if (authButtons && (label === "Login" || label === "Sign Up")) return;
    const link = el("a", href === currentPage ? "active" : "", label);
    link.href = href;
    if (label === "Cart") {
      link.classList.add("cart-link");
      const count = el("span", "", "");
      count.id = "nv-cart-count";
      link.append(count);
    }
    container.append(link);
  });

  if (user) {
    const logoutLink = el("a", "logout-btn", "Logout");
    logoutLink.href = "login.html";
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      logout();
    });
    if (authButtons) {
      authButtons.replaceChildren();
      const profile = el("a");
      profile.href = role === "cook" ? "my-foods.html" : role === "admin" ? "admin-dashboard.html" : "user-profile.html";
      profile.append(el("button", "button-login", user.name ? user.name.split(" ")[0] : "Profile"));
      const out = el("a");
      out.href = "login.html";
      out.append(el("button", "button-signup", "Logout"));
      out.addEventListener("click", (event) => {
        event.preventDefault();
        logout();
      });
      authButtons.append(profile, out);
    } else {
      container.append(logoutLink);
    }
  }

  // Logo goes home
  const logo = document.querySelector(".navbar .logo img, .navbar .brand img");
  if (logo && !logo.closest("a")) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", () => (window.location.href = "index.html"));
  }

  if (role === "customer") refreshCartCount();
}

document.addEventListener("DOMContentLoaded", setupNavbar);
