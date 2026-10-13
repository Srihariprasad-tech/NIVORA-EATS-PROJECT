const mongoose = require("mongoose");
const crypto = require("crypto");

// 1. Individual food item snapshot
const orderItemSchema = new mongoose.Schema(
    {
        food: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Food",
            required: true
        },

        foodName: {
            type: String,
            required: true,
            trim: true
        },

        image: {
            type: String,
            default: ""
        },

        cook: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "Quantity must be a whole number"
            }
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        itemTotal: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        _id: false
    }
);

// 2. Delivery address snapshot
const deliveryAddressSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },

        phoneNo: {
            type: String,
            required: true,
            trim: true
        },

        addressLine: {
            type: String,
            required: true,
            trim: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        state: {
            type: String,
            required: true,
            trim: true
        },

        pincode: {
            type: String,
            required: true
        },

        landmark: {
            type: String,
            default: ""
        }
    },
    {
        _id: false
    }
);

// 3. Main order schema
const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            immutable: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: true,
            index: true
        },

        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: function (items) {
                    return items.length > 0;
                },
                message: "An order must contain at least one item"
            }
        },

        deliveryAddress: {
            type: deliveryAddressSchema,
            required: true
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        deliveryFee: {
            type: Number,
            required: true,
            min: 0,
            default: 40
        },

        grandTotal: {
            type: Number,
            required: true,
            min: 0
        },

        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "payment",
            required: true
        },
paymentStatus: {
    type: String,
    enum: ["pending", "paid", "refund_pending", "refunded", "refund_failed"],
    default: "pending"
},

        orderStatus: {
    type: String,
    enum: ["confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"],
    default: "confirmed"
},

        notes: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        placedAt: {
            type: Date,
            default: Date.now
        },

        deliveredAt: {
            type: Date,
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Generate a unique order number automatically
orderSchema.pre("validate", function () {
    if (!this.orderNumber) {
        this.orderNumber =
            `ORD-${Date.now()}-${crypto.randomBytes(3)
                .toString("hex")
                .toUpperCase()}`;
    }
});

// Export model
module.exports = mongoose.model("Order", orderSchema);
