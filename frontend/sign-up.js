// Sign-up page: POST /auth -> then log in automatically -> go to the right page

const signupForm = document.getElementById("signup-form");
const signupButton = document.getElementById("signup-button");
const signupMessage = document.getElementById("signup-message");

function showSignupMessage(text, isError) {
  signupMessage.textContent = text;
  signupMessage.style.color = isError ? "#c0392b" : "#2e7d32";
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const phone = document.getElementById("signup-phone").value.trim();
  const role = document.getElementById("signup-role").value;

  // Same rules as the backend (uservalidation.js + user model)
  if (name.length < 2) {
    showSignupMessage("Please enter your full name.", true);
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    showSignupMessage("Please enter a valid email address.", true);
    return;
  }
  if (password.length < 8) {
    showSignupMessage("Password must be at least 8 characters.", true);
    return;
  }
  if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ""))) {
    showSignupMessage("Please enter a valid phone number (10 digits).", true);
    return;
  }
  if (role !== "customer" && role !== "cook") {
    showSignupMessage("Please select Customer or Cook.", true);
    return;
  }

  signupButton.disabled = true;
  showSignupMessage("Creating your account...", false);

  try {
    await apiFetch("/auth", {
      method: "POST",
      body: { name, email, password, phone: phone.replace(/[\s-]/g, ""), role }
    });

    // Log in straight away so the user doesn't have to type it again
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    saveSession(data.token, data.user);
    showSignupMessage("Account created!", false);
    window.location.href = homePageFor(data.user.role);
  } catch (error) {
    showSignupMessage(error.message, true);
    signupButton.disabled = false;
  }
});
