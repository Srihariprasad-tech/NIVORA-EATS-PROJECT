const orderservice = require("../services/orderServices");

// Read the logged-in user's ID and role (set by authmiddleware)
const getUserId = (req) => req.user.userid || req.user.id || req.user._id;
const getRole = (req) => req.user.role;

// CREATE ORDER
const createOrder = async (req, res, next) => {
    try {
        const { addressId, paymentId, notes } = req.body || {};

        if (!addressId || !paymentId) {
            return res.status(400).json({
                success: false,
                message: "Address ID and payment ID are required"
            });
        }

        const order = await orderservice.createOrder({
            userId: getUserId(req),
            addressId,
            paymentId,
            notes
        });

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order
        });
    } catch (error) {
        next(error);
    }
};

// GET ALL MY ORDERS
const getMyOrders = async (req, res, next) => {
    try {
        const orders = await orderservice.getMyOrders(getUserId(req));

        return res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        next(error);
    }
};

// GET ONE ORDER
const getOrderById = async (req, res, next) => {
    try {
        const order = await orderservice.getOrderById(
            req.params.id,
            getUserId(req)
        );

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        next(error);
    }
};

// UPDATE ORDER STATUS (cook / admin)
const updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body || {};

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required"
            });
        }

        const order = await orderservice.updateOrderStatus({
            orderId: req.params.id,
            userId: getUserId(req),
            role: getRole(req),
            status
        });

        return res.status(200).json({
            success: true,
            message: `Order status updated to ${order.orderStatus}`,
            order
        });
    } catch (error) {
        next(error);
    }
};

// CANCEL ORDER + REFUND
const cancelOrder = async (req, res, next) => {
    try {
        const { reason } = req.body || {};

        const order = await orderservice.cancelOrder({
            orderId: req.params.id,
            userId: getUserId(req),
            role: getRole(req),
            reason
        });

        return res.status(200).json({
            success: true,
            message:
                order.paymentStatus === "refunded"
                    ? "Order cancelled and refund initiated"
                    : "Order cancelled",
            order
        });
    } catch (error) {
        next(error);
    }
};

// GET ORDERS FOR THE LOGGED-IN COOK
const getCookOrders = async (req, res, next) => {
    try {
        const { page, limit, status } = req.query;

        const result = await orderservice.getCookOrders({
            cookId: getUserId(req),
            page,
            limit,
            status
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

// GET ALL ORDERS (admin)
const getAllOrders = async (req, res, next) => {
    try {
        const { page, limit, status, paymentStatus, userId, from, to } = req.query;

        const result = await orderservice.getAllOrders({
            page,
            limit,
            status,
            paymentStatus,
            userId,
            from,
            to
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
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