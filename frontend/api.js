// =====================================================
// Nivora Eats - shared API helper (include on every page that talks to the backend)
// =====================================================

// 1) Backend URL
//    LIVE: put your Render backend address here (no "/" at the end).
const BACKEND_URL = "https://YOUR-BACKEND-NAME.onrender.com";

//    TESTING on your computer (Live Server, localhost, or opening the file)
//    automatically uses your local backend instead.
const IS_LOCAL =
  location.protocol === "file:" ||
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

const API_BASE = IS_LOCAL ? "http://localhost:3000" : BACKEND_URL.replace(/\/$/, "");

// 2) Login session (token + user) saved in the browser
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

// 3) Call the backend. Adds the token, sends JSON, and throws an Error
//    with the backend's message when the request fails.
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
    throw new Error("Cannot reach the server. Please check your internet or try again later.");
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
    window.location.href = "login.html";
    throw new Error("Please log in again.");
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }

  return data;
}

// 4) Protect a page: requireLogin() or requireLogin(["cook"])
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
