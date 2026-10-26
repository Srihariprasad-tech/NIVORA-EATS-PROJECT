// FILE: backend/src/controllers/reviewController.js

const reviewservice = require("../services/reviewService");

// Read the logged-in user's ID and role (set by authmiddleware)
const getUserId = (req) => req.user.userid || req.user.id || req.user._id;
const getRole = (req) => req.user.role;

// CREATE REVIEW
const createReview = async (req, res, next) => {
    try {
        const { foodId, rating, comment } = req.body || {};

        if (!foodId || rating === undefined) {
            return res.status(400).json({
                success: false,
                message: "Food ID and rating are required"
            });
        }

        const review = await reviewservice.createReview({
            userId: getUserId(req),
            foodId,
            rating,
            comment
        });

        return res.status(201).json({
            success: true,
            message: "Review added successfully",
            review
        });
    } catch (error) {
        next(error);
    }
};

// GET REVIEWS FOR A FOOD
const getFoodReviews = async (req, res, next) => {
    try {
        const { page, limit, sort, rating } = req.query;

        const result = await reviewservice.getFoodReviews({
            foodId: req.params.foodId,
            page,
            limit,
            sort,
            rating
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

// GET ONE REVIEW
const getReviewById = async (req, res, next) => {
    try {
        const review = await reviewservice.getReviewById(req.params.id);

        return res.status(200).json({
            success: true,
            review
        });
    } catch (error) {
        next(error);
    }
};

// EDIT YOUR OWN REVIEW
const updateReview = async (req, res, next) => {
    try {
        const { rating, comment } = req.body || {};

        const review = await reviewservice.updateReview({
            reviewId: req.params.id,
            userId: getUserId(req),
            rating,
            comment
        });

        return res.status(200).json({
            success: true,
            message: "Review updated successfully",
            review
        });
    } catch (error) {
        next(error);
    }
};

// DELETE YOUR OWN REVIEW
const deleteReview = async (req, res, next) => {
    try {
        await reviewservice.deleteReview({
            reviewId: req.params.id,
            userId: getUserId(req),
            role: getRole(req)
        });

        return res.status(200).json({
            success: true,
            message: "Review deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createReview,
    getFoodReviews,
    getReviewById,
    updateReview,
    deleteReview
};