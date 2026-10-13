const express = require("express");
const router = express.Router();
const authmidd = require("../middleware/authmiddleware");
const ordercontroller = require("../controllers/orderController");

// Allow only the given roles (reads req.user.role set by authmiddleware)
const allowRoles = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: "Access denied"
        });
    }
    next();
};

// ---------- Customer ----------
router.post("/", authmidd, ordercontroller.createOrder);       // POST  /orders
router.get("/", authmidd, ordercontroller.getMyOrders);        // GET   /orders

// ---------- Cook & admin lists (must be before "/:id") ----------
router.get(
    "/cook",
    authmidd,
    allowRoles("cook"),
    ordercontroller.getCookOrders
);                                                              // GET   /orders/cook

router.get(
    "/admin/all",
    authmidd,
    allowRoles("admin"),
    ordercontroller.getAllOrders
);                                                              // GET   /orders/admin/all

// ---------- Status & cancel ----------
router.patch(
    "/:id/status",
    authmidd,
    allowRoles("cook", "admin"),
    ordercontroller.updateOrderStatus
);                                                              // PATCH /orders/:id/status

router.patch(
    "/:id/cancel",
    authmidd,
    ordercontroller.cancelOrder
);                                                              // PATCH /orders/:id/cancel

// ---------- One order (keep last) ----------
router.get("/:id", authmidd, ordercontroller.getOrderById);    // GET   /orders/:id

module.exports = router;