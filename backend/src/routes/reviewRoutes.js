// FILE: backend/src/routes/reviewRoutes.js
// Mount in app.js as: app.use("/reviews", reviewroutes);

const express = require("express");
const router = express.Router();
const authmidd = require("../middleware/authmiddleware");
const reviewcontroller = require("../controllers/reviewController");

// Logged-in users
router.post("/", authmidd, reviewcontroller.createReview);              // POST   /reviews

// Public (no login needed to read reviews)
router.get("/food/:foodId", reviewcontroller.getFoodReviews);           // GET    /reviews/food/:foodId
router.get("/:id", reviewcontroller.getReviewById);                     // GET    /reviews/:id

// Owner only (admin can also delete)
router.patch("/:id", authmidd, reviewcontroller.updateReview);          // PATCH  /reviews/:id
router.delete("/:id", authmidd, reviewcontroller.deleteReview);         // DELETE /reviews/:id

module.exports = router;