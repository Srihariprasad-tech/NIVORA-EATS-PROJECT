// FILE: backend/src/services/reviewService.js

const mongoose = require("mongoose");

const Review = require("../models/review");
const Food = require("../models/food");
const Order = require("../models/orders");

// Helper to create errors that your error middleware can handle
const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Page and limit from query strings (max 50 per page)
const getPagination = (page, limit) => {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    return {
        page: safePage,
        limit: safeLimit,
        skip: (safePage - 1) * safeLimit
    };
};

// Validate rating: whole number 1 to 5
const parseRating = (rating) => {
    const value = Number(rating);

    if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw createError("Rating must be a whole number from 1 to 5", 400);
    }

    return value;
};

// Validate comment: optional text, max 1000 characters
const parseComment = (comment) => {
    if (comment === undefined || comment === null) {
        return "";
    }

    if (typeof comment !== "string") {
        throw createError("Comment must be text", 400);
    }

    const clean = comment.trim();

    if (clean.length > 1000) {
        throw createError("Comment cannot be longer than 1000 characters", 400);
    }

    return clean;
};

// Sort options for the food reviews list
const SORT_OPTIONS = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 }
};

// --------------------------------------------------
// Recalculate a food's average rating and review count
// --------------------------------------------------
const updateFoodRating = async (foodId) => {
    const [stats] = await Review.aggregate([
        { $match: { food: new mongoose.Types.ObjectId(String(foodId)) } },
        {
            $group: {
                _id: "$food",
                averageRating: { $avg: "$rating" },
                reviewCount: { $sum: 1 }
            }
        }
    ]);

    await Food.findByIdAndUpdate(foodId, {
        averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
        reviewCount: stats ? stats.reviewCount : 0
    });
};

// --------------------------------------------------
// 1. CREATE REVIEW
// --------------------------------------------------
const createReview = async ({ userId, foodId, rating, comment }) => {
    if (!mongoose.isValidObjectId(foodId)) {
        throw createError("Invalid food ID", 400);
    }

    const cleanRating = parseRating(rating);
    const cleanComment = parseComment(comment);

    const food = await Food.findById(foodId);

    if (!food || food.isActive === false) {
        throw createError("Food item not found", 404);
    }

    // Only customers who received this food can review it
    const deliveredOrder = await Order.findOne({
        user: userId,
        orderStatus: "delivered",
        "items.food": foodId
    }).sort({ createdAt: -1 });

    if (!deliveredOrder) {
        throw createError(
            "You can review this food only after it has been delivered to you",
            403
        );
    }

    // One review per user per food
    const existing = await Review.findOne({ user: userId, food: foodId });

    if (existing) {
        throw createError(
            "You have already reviewed this food. Edit your existing review instead.",
            409
        );
    }

    let review;

    try {
        review = await Review.create({
            user: userId,
            food: foodId,
            order: deliveredOrder._id,
            cook: food.cook,
            rating: cleanRating,
            comment: cleanComment
        });
    } catch (error) {
        // Two requests at the same time can both pass the check above
        if (error.code === 11000) {
            throw createError("You have already reviewed this food", 409);
        }
        throw error;
    }

    await updateFoodRating(foodId);

    return review;
};

// --------------------------------------------------
// 2. GET REVIEWS FOR A FOOD (public)
// --------------------------------------------------
const getFoodReviews = async ({ foodId, page, limit, sort, rating }) => {
    if (!mongoose.isValidObjectId(foodId)) {
        throw createError("Invalid food ID", 400);
    }

    const food = await Food.findById(foodId).select(
        "name averageRating reviewCount"
    );

    if (!food) {
        throw createError("Food item not found", 404);
    }

    const pagination = getPagination(page, limit);
    const sortBy = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

    const filter = { food: foodId };

    // Optional filter: only 5-star, only 1-star, etc.
    if (rating !== undefined && rating !== "") {
        filter.rating = parseRating(rating);
    }

    const [reviews, total, breakdownRows] = await Promise.all([
        Review.find(filter)
            .populate("user", "name")
            .sort(sortBy)
            .skip(pagination.skip)
            .limit(pagination.limit)
            .lean(),
        Review.countDocuments(filter),
        Review.aggregate([
            { $match: { food: new mongoose.Types.ObjectId(String(foodId)) } },
            { $group: { _id: "$rating", count: { $sum: 1 } } }
        ])
    ]);

    // Count of 5, 4, 3, 2, 1 star reviews
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const row of breakdownRows) {
        breakdown[row._id] = row.count;
    }

    return {
        food: {
            _id: food._id,
            name: food.name,
            averageRating: food.averageRating || 0,
            reviewCount: food.reviewCount || 0,
            breakdown
        },
        reviews,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
    };
};

// --------------------------------------------------
// 3. GET ONE REVIEW (public)
// --------------------------------------------------
const getReviewById = async (reviewId) => {
    if (!mongoose.isValidObjectId(reviewId)) {
        throw createError("Invalid review ID", 400);
    }

    const review = await Review.findById(reviewId)
        .populate("user", "name")
        .populate("food", "name");

    if (!review) {
        throw createError("Review not found", 404);
    }

    return review;
};

// --------------------------------------------------
// 4. EDIT YOUR OWN REVIEW
// --------------------------------------------------
const updateReview = async ({ reviewId, userId, rating, comment }) => {
    if (!mongoose.isValidObjectId(reviewId)) {
        throw createError("Invalid review ID", 400);
    }

    if (rating === undefined && comment === undefined) {
        throw createError("Send a rating or a comment to update", 400);
    }

    // Find only a review that belongs to this user
    const review = await Review.findOne({ _id: reviewId, user: userId });

    if (!review) {
        throw createError("Review not found", 404);
    }

    if (rating !== undefined) {
        review.rating = parseRating(rating);
    }

    if (comment !== undefined) {
        review.comment = parseComment(comment);
    }

    review.isEdited = true;
    await review.save();

    await updateFoodRating(review.food);

    return review;
};

// --------------------------------------------------
// 5. DELETE YOUR OWN REVIEW (admin can delete any)
// --------------------------------------------------
const deleteReview = async ({ reviewId, userId, role }) => {
    if (!mongoose.isValidObjectId(reviewId)) {
        throw createError("Invalid review ID", 400);
    }

    const filter =
        role === "admin"
            ? { _id: reviewId }
            : { _id: reviewId, user: userId };

    const review = await Review.findOneAndDelete(filter);

    if (!review) {
        throw createError("Review not found", 404);
    }

    await updateFoodRating(review.food);

    return review;
};

module.exports = {
    createReview,
    getFoodReviews,
    getReviewById,
    updateReview,
    deleteReview
};