// =====================================================
// Add / Edit dish (cooks)
// POST  /food        -> { food }        (add)
// GET   /food/:id    -> { getid }       (edit: load)
// PATCH /food/:id    -> { updatedfood } (edit: save)
// Photo: uploaded from the browser straight to Cloudinary (unsigned preset),
// then the Cloudinary link is saved in images[0].url
// =====================================================

const cookUser = requireLogin(["cook"]);

const foodForm = document.getElementById("food-form");
const formMessage = document.getElementById("form-message");
const saveDishButton = document.getElementById("save-dish");
const saveDishText = document.getElementById("save-dish-text");
const imageInput = document.getElementById("food-image");
const imageUrlInput = document.getElementById("image-url");
const imagePreview = document.getElementById("image-preview");

const editId = new URLSearchParams(location.search).get("id");
let existingImages = [];

function showFormMessage(text, type) {
  formMessage.textContent = text || "";
  formMessage.className = "nv-form-message" + (type ? " " + type : "");
}

function value(id) {
  return document.getElementById(id).value.trim();
}

// Preview the chosen photo
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) {
    imagePreview.style.display = "none";
    return;
  }
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = "block";
});

async function uploadToCloudinary(file) {
  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME" || CLOUDINARY_UPLOAD_PRESET === "YOUR_UNSIGNED_PRESET") {
    throw new Error("Photo upload is not set up yet (Cloudinary settings in api.js). Paste an image link instead.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Photo is too large. Please choose one under 5 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData
    });
  } catch (error) {
    throw new Error("Could not upload the photo. Check your internet and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) {
    throw new Error((data.error && data.error.message) || "Photo upload failed.");
  }
  // Ask Cloudinary for a compressed, web-sized version
  return data.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_800/");
}

// Same rules as backend/src/models/food.js
function readFoodForm() {
  const data = {
    name: value("dish-name"),
    price: Number(value("price")),
    cuisine: value("cuisine"),
    region: value("region"),
    foodType: value("foodType"),
    category: value("category").toLowerCase(),
    servingSize: value("servingSize"),
    preparationTime: Number(value("preparationTime")),
    spiceLevel: value("spiceLevel"),
    ingredients: value("ingredients").split(",").map(s => s.trim()).filter(Boolean),
    shortDescription: value("shortDescription"),
    description: value("description")
  };

  if (data.name.length < 10 || data.name.length > 30) return "Dish name must be 10 to 30 characters (e.g. \"Kolhapuri Misal Pav\").";
  if (!Number.isFinite(data.price) || data.price < 1) return "Please enter a price of at least ₹1.";
  if (!data.cuisine) return "Please choose a cuisine.";
  if (!data.region) return "Please enter the region or city.";
  if (!data.category) return "Please enter a category.";
  if (!data.servingSize) return "Please enter the serving size.";
  if (!Number.isInteger(data.preparationTime) || data.preparationTime < 1) return "Preparation time must be a whole number of minutes.";
  if (data.description.length < 20 || data.description.length > 300) return "Description must be 20 to 300 characters.";
  if (!data.shortDescription) delete data.shortDescription;
  return data;
}

foodForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = readFoodForm();
  if (typeof data === "string") {
    showFormMessage(data, "error");
    return;
  }

  saveDishButton.disabled = true;
  try {
    // Photo: new upload > pasted link > keep the old one
    const file = imageInput.files[0];
    const pastedUrl = imageUrlInput.value.trim();
    if (file) {
      showFormMessage("Uploading photo...");
      data.images = [{ url: await uploadToCloudinary(file), altText: data.name }];
    } else if (pastedUrl) {
      if (!/^https?:\/\//i.test(pastedUrl)) throw new Error("Image link must start with https://");
      data.images = [{ url: pastedUrl, altText: data.name }];
    } else if (!editId) {
      throw new Error("Please add a photo of the dish.");
    }

    showFormMessage("Saving dish...");
    if (editId) {
      const result = await apiFetch("/food/" + editId, { method: "PATCH", body: data });
      if (!result.updatedfood) throw new Error("You can only edit your own dishes.");
    } else {
      await apiFetch("/food", { method: "POST", body: data });
    }

    showFormMessage(editId ? "Dish updated ✓" : "Dish added ✓", "success");
    setTimeout(() => (window.location.href = "my-foods.html"), 800);
  } catch (error) {
    showFormMessage(error.message, "error");
    saveDishButton.disabled = false;
  }
});

// Edit mode: cook-dashboard.html?id=<foodId>
async function loadDishForEdit() {
  document.getElementById("form-heading").textContent = "Edit Food Item";
  document.getElementById("form-subheading").textContent = "Update the details of your dish.";
  saveDishText.textContent = "Save Changes";
  showFormMessage("Loading dish...");

  try {
    const data = await apiFetch("/food/" + encodeURIComponent(editId));
    const food = data.getid;
    if (!food) throw new Error("Dish not found.");
    if (String(food.cook) !== String(cookUser._id)) throw new Error("You can only edit your own dishes.");

    const set = (id, val) => (document.getElementById(id).value = val === undefined || val === null ? "" : val);
    set("dish-name", food.name);
    set("price", food.price);
    set("cuisine", food.cuisine);
    set("region", food.region);
    set("foodType", food.foodType);
    set("category", food.category);
    set("servingSize", food.servingSize);
    set("preparationTime", food.preparationTime);
    set("spiceLevel", food.spiceLevel || "medium");
    set("ingredients", (food.ingredients || []).join(", "));
    set("shortDescription", food.shortDescription);
    set("description", food.description);

    existingImages = food.images || [];
    if (existingImages[0]) {
      imagePreview.src = existingImages[0].url;
      imagePreview.style.display = "block";
    }
    showFormMessage("");
  } catch (error) {
    showFormMessage(error.message, "error");
    saveDishButton.disabled = true;
  }
}

if (cookUser && editId) {
  loadDishForEdit();
}
