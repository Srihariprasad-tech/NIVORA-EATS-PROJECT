// FILE: backend/src/models/review.js

const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        food: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Food",
            required: true
        },
        // The delivered order that proves the user actually ate this food
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true
        },
        // Cook who made the food (handy for cook dashboards later)
        cook: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user"
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            validate: {
                validator: Number.isInteger,
                message: "Rating must be a whole number from 1 to 5"
            }
        },
        comment: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ""
        },
        isEdited: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// One review per user per food item
reviewSchema.index({ user: 1, food: 1 }, { unique: true });

// Fast "reviews for this food, newest first"
reviewSchema.index({ food: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);