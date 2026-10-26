const mongoose = require("mongoose");
const Order = require("../models/orders");
const Cart = require("../models/cart");
const Food = require("../models/food");
const Address = require("../models/address");
const Payment = require("../models/payments");
const razorpay = require("../config/razorpay");

// Helper to create errors that your error middleware can handle
const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

// Keep monetary calculations consistent to two decimal places
const money = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

// --------------------------------------------------
// STATUS RULES
// --------------------------------------------------
const ORDER_STATUSES = [
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled"
];

const PAYMENT_STATUSES = [
    "pending",
    "paid",
    "refund_pending",
    "refunded",
    "refund_failed"
];

// Which status can come next
const STATUS_FLOW = {
    confirmed: ["preparing"],
    preparing: ["ready"],
    ready: ["out_for_delivery"],
    out_for_delivery: ["delivered"]
};

// Which statuses each role may set
const ROLE_ALLOWED_STATUSES = {
    cook: ["preparing", "ready"],
    delivery: ["out_for_delivery", "delivered"],
    admin: ["preparing", "ready", "out_for_delivery", "delivered"]
};

// Which statuses each role may cancel from
const CANCELLABLE_BY_ROLE = {
    customer: ["confirmed"],
    cook: ["confirmed", "preparing"],
    admin: ["confirmed", "preparing", "ready", "out_for_delivery"]
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

// --------------------------------------------------
// 1. CREATE ORDER AFTER VERIFIED PAYMENT
// --------------------------------------------------
const createOrder = async ({ userId, addressId, paymentId, notes = "" }) => {
    if (
        !mongoose.isValidObjectId(userId) ||
        !mongoose.isValidObjectId(addressId) ||
        !mongoose.isValidObjectId(paymentId)
    ) {
        throw createError("Invalid user, address, or payment ID", 400);
    }

    // Find the payment belonging to this user
    const payment = await Payment.findOne({ _id: paymentId, user: userId });

    if (!payment) {
        throw createError("Payment record not found", 404);
    }

    // Do not create orders for unverified payments
    if (payment.status !== "paid" || payment.verified !== true) {
        throw createError("Payment is not verified and paid", 400);
    }

    // Avoid creating another order for the same payment
    const existingOrder = await Order.findOne({ payment: payment._id });

    if (existingOrder) {
        return existingOrder;
    }

    // Find the customer's cart
    const cart = await Cart.findOne({ user: userId });

    if (!cart || cart.items.length === 0) {
        throw createError("Cart is empty or not found", 400);
    }

    // Find the address owned by this customer
    const address = await Address.findOne({ _id: addressId, user: userId });

    if (!address) {
        throw createError("Delivery address not found", 404);
    }

    // Build order items using current database data
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
        const food = await Food.findById(cartItem.food);

        if (!food || !food.isActive || !food.isAvailable) {
            throw createError("One or more food items are unavailable", 400);
        }

        if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1) {
            throw createError("Invalid cart quantity", 400);
        }

        const price = money(food.price);
        const itemTotal = money(price * cartItem.quantity);

        orderItems.push({
            food: food._id,
            foodName: food.name,
            image: food.images?.[0]?.url || "",
            cook: food.cook,
            quantity: cartItem.quantity,
            price,
            itemTotal
        });

        subtotal = money(subtotal + itemTotal);
    }

    // Calculate the final total on the backend
    const deliveryFee = 40;
    const grandTotal = money(subtotal + deliveryFee);

    // Ensure the paid amount matches the order total
    if (money(payment.amount) !== grandTotal) {
        throw createError("Payment amount does not match the order total", 400);
    }

    // Copy the address so future edits do not change this order
    const deliveryAddress = {
        fullName: address.fullName,
        phoneNo: address.phoneNo,
        addressLine: address.addressLine,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark || ""
    };

    // Save the order
    const order = await Order.create({
        user: userId,
        items: orderItems,
        deliveryAddress,
        subtotal,
        deliveryFee,
        grandTotal,
        payment: payment._id,
        paymentStatus: "paid",
        orderStatus: "confirmed",
        notes,
        statusHistory: [
            {
                status: "confirmed",
                role: "customer",
                changedBy: userId,
                changedAt: new Date()
            }
        ]
    });

    // Clear the cart only after saving the order
    await Cart.updateOne(
        { _id: cart._id, user: userId },
        { $set: { items: [], subtotal: 0 } }
    );

    return order;
};

// --------------------------------------------------
// 2. GET ALL ORDERS FOR THE LOGGED-IN CUSTOMER
// --------------------------------------------------
const getMyOrders = async (userId) => {
    return Order.find({ user: userId }).sort({ createdAt: -1 });
};

// --------------------------------------------------
// 3. GET ONE ORDER BELONGING TO THE LOGGED-IN CUSTOMER
// --------------------------------------------------
const getOrderById = async (orderId, userId) => {
    if (!mongoose.isValidObjectId(orderId)) {
        throw createError("Invalid order ID", 400);
    }

    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
        throw createError("Order not found", 404);
    }

    return order;
};

// --------------------------------------------------
// 4. UPDATE ORDER STATUS (cook / admin)
// --------------------------------------------------
const updateOrderStatus = async ({ orderId, userId, role, status }) => {
    if (!mongoose.isValidObjectId(orderId)) {
        throw createError("Invalid order ID", 400);
    }

    const allowedForRole = ROLE_ALLOWED_STATUSES[role];

    if (!allowedForRole) {
        throw createError("You are not allowed to update order status", 403);
    }

    if (typeof status !== "string" || !allowedForRole.includes(status)) {
        throw createError(
            `As ${role}, you can only set status to: ${allowedForRole.join(", ")}`,
            403
        );
    }

    const order = await Order.findById(orderId);

    if (!order) {
        throw createError("Order not found", 404);
    }

    // A cook can only update orders that contain their food
    if (role === "cook") {
        const ownsItem = order.items.some(
            (item) => String(item.cook) === String(userId)
        );

        if (!ownsItem) {
            throw createError("This order does not belong to you", 403);
        }
    }

    // Check the status moves forward correctly
    const nextAllowed = STATUS_FLOW[order.orderStatus] || [];

    if (!nextAllowed.includes(status)) {
        throw createError(
            `Cannot change order from "${order.orderStatus}" to "${status}"`,
            400
        );
    }

    const update = {
        $set: { orderStatus: status },
        $push: {
            statusHistory: {
                status,
                role,
                changedBy: userId,
                changedAt: new Date()
            }
        }
    };

    if (status === "delivered") {
        update.$set.deliveredAt = new Date();
    }

    // Only update if nobody changed the status in the meantime
    const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, orderStatus: order.orderStatus },
        update,
        { new: true, runValidators: true }
    );

    if (!updatedOrder) {
        throw createError("Order was updated by someone else. Please try again.", 409);
    }

    return updatedOrder;
};

// --------------------------------------------------
// REFUND HELPER (used by cancelOrder)
// --------------------------------------------------
const processRefund = async (order) => {
    const payment = await Payment.findById(order.payment);

    if (!payment || !payment.razorpayPaymentId) {
        order.paymentStatus = "refund_failed";
        await order.save();
        throw createError("Order cancelled, but no payment was found to refund", 500);
    }

    // Already refunded earlier: just sync the order
    if (payment.status === "refunded") {
        order.paymentStatus = "refunded";
        order.refundId = payment.refundId;
        await order.save();
        return order;
    }

    order.paymentStatus = "refund_pending";
    await order.save();

    try {
        const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
            amount: Math.round(Number(payment.amount) * 100), // full refund in paise
            speed: "normal",
            notes: { orderId: String(order._id) }
        });

        payment.status = "refunded";
        payment.refundId = refund.id;
        payment.refundedAt = new Date();
        await payment.save();

        order.paymentStatus = "refunded";
        order.refundId = refund.id;
        await order.save();

        return order;
    } catch (error) {
        console.error(
            "Razorpay refund failed for order",
            String(order._id),
            error?.error?.description || error.message
        );

        order.paymentStatus = "refund_failed";
        await order.save();

        throw createError(
            "Order cancelled, but the refund failed. Call cancel again to retry the refund.",
            502
        );
    }
};

// --------------------------------------------------
// 5. CANCEL ORDER + REFUND
// --------------------------------------------------
const cancelOrder = async ({ orderId, userId, role, reason = "" }) => {
    if (!mongoose.isValidObjectId(orderId)) {
        throw createError("Invalid order ID", 400);
    }

    // Anyone who is not cook/admin is treated as a customer
    const actorRole = role === "admin" || role === "cook" ? role : "customer";

    // Who can see which orders
    let filter;

    if (actorRole === "admin") {
        filter = { _id: orderId };
    } else if (actorRole === "cook") {
        filter = { _id: orderId, "items.cook": userId };
    } else {
        filter = { _id: orderId, user: userId };
    }

    const order = await Order.findOne(filter);

    if (!order) {
        throw createError("Order not found", 404);
    }

    // Already cancelled: return it, or retry a failed refund
    if (order.orderStatus === "cancelled") {
        if (order.paymentStatus === "refund_failed") {
            return processRefund(order);
        }
        return order;
    }

    const cancellable = CANCELLABLE_BY_ROLE[actorRole];

    if (!cancellable.includes(order.orderStatus)) {
        throw createError(
            `Order cannot be cancelled when it is "${order.orderStatus}"`,
            400
        );
    }

    const cleanReason = String(reason || "").trim().slice(0, 300);

    // Cancel only if the status has not changed in the meantime
    const cancelledOrder = await Order.findOneAndUpdate(
        { _id: orderId, orderStatus: order.orderStatus },
        {
            $set: {
                orderStatus: "cancelled",
                cancelReason: cleanReason,
                cancelledBy: { user: userId, role: actorRole },
                cancelledAt: new Date()
            },
            $push: {
                statusHistory: {
                    status: "cancelled",
                    role: actorRole,
                    changedBy: userId,
                    changedAt: new Date()
                }
            }
        },
        { new: true, runValidators: true }
    );

    if (!cancelledOrder) {
        throw createError("Order was updated by someone else. Please try again.", 409);
    }

    // Refund only paid orders
    if (cancelledOrder.paymentStatus === "paid") {
        return processRefund(cancelledOrder);
    }

    return cancelledOrder;
};

// --------------------------------------------------
// 6. GET ORDERS FOR THE LOGGED-IN COOK
// --------------------------------------------------
const getCookOrders = async ({ cookId, page, limit, status }) => {
    const pagination = getPagination(page, limit);

    const filter = { "items.cook": cookId };

    if (status) {
        if (!ORDER_STATUSES.includes(status)) {
            throw createError("Invalid status filter", 400);
        }
        filter.orderStatus = status;
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .lean(),
        Order.countDocuments(filter)
    ]);

    // Show the cook only their own items and earnings
    const cookOrders = orders.map((order) => {
        const myItems = order.items.filter(
            (item) => String(item.cook) === String(cookId)
        );

        const cookSubtotal = money(
            myItems.reduce((sum, item) => sum + item.itemTotal, 0)
        );

        return {
            _id: order._id,
            orderStatus: order.orderStatus,
            paymentStatus: order.paymentStatus,
            deliveryAddress: order.deliveryAddress,
            notes: order.notes,
            items: myItems,
            cookSubtotal,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        };
    });

    return {
        orders: cookOrders,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
    };
};

// --------------------------------------------------
// 7. GET ALL ORDERS (admin) WITH PAGINATION + FILTERS
// --------------------------------------------------
const getAllOrders = async ({ page, limit, status, paymentStatus, userId, from, to }) => {
    const pagination = getPagination(page, limit);
    const filter = {};

    if (status) {
        if (!ORDER_STATUSES.includes(status)) {
            throw createError("Invalid status filter", 400);
        }
        filter.orderStatus = status;
    }

    if (paymentStatus) {
        if (!PAYMENT_STATUSES.includes(paymentStatus)) {
            throw createError("Invalid payment status filter", 400);
        }
        filter.paymentStatus = paymentStatus;
    }

    if (userId) {
        if (!mongoose.isValidObjectId(userId)) {
            throw createError("Invalid user ID filter", 400);
        }
        filter.user = userId;
    }

    if (from || to) {
        filter.createdAt = {};

        if (from) {
            const fromDate = new Date(from);
            if (isNaN(fromDate)) throw createError("Invalid 'from' date", 400);
            filter.createdAt.$gte = fromDate;
        }

        if (to) {
            const toDate = new Date(to);
            if (isNaN(toDate)) throw createError("Invalid 'to' date", 400);
            toDate.setHours(23, 59, 59, 999); // include the whole day
            filter.createdAt.$lte = toDate;
        }
    }

    const [orders, total] = await Promise.all([
        Order.find(filter)
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .lean(),
        Order.countDocuments(filter)
    ]);

    return {
        orders,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
    };
};

module.exports = {
    createOrder,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder,
    getCookOrders,
    getAllOrders
};
