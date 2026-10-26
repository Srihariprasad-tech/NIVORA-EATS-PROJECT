// Login page: POST /auth/login -> save token -> go to the right page for the role

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");

function showLoginMessage(text, isError) {
  loginMessage.textContent = text;
  loginMessage.style.color = isError ? "#c0392b" : "#2e7d32";
}

// Already logged in? Skip the login page.
const existingUser = getUser();
if (getToken() && existingUser) {
  window.location.href = homePageFor(existingUser.role);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showLoginMessage("Please enter your email and password.", true);
    return;
  }

  loginButton.disabled = true;
  showLoginMessage("Logging in...", false);

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    saveSession(data.token, data.user);
    showLoginMessage("Login successful!", false);
    window.location.href = homePageFor(data.user.role);
  } catch (error) {
    showLoginMessage(error.message, true);
    loginButton.disabled = false;
  }
});
