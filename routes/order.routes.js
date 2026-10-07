// routes/order.routes.js
const express = require("express");
const router = express.Router();
const {
  createOrder,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIpn,
  getOrderByTransactionId,
  getStoreOrders,
  getStoreOrderById,
  updateOrderStatus,
  getOrderStats,
} = require("../controller/order.controller");
const {
  getSalesOverview,
  getRevenueChart,
  getTopProducts,
  getRecentOrders,
  getPaymentBreakdown,
  getSalesByCategory,
} = require("../controller/sales.controller");
const verifyStoreOwnerJWT = require("../middleware/verifyStoreOwnerJWT");

/* =========================================================================
   PUBLIC ROUTES
========================================================================= */
router.post("/create-order", createOrder);
router.get("/status/:tran_id", getOrderByTransactionId);

/* =========================================================================
   SSL CALLBACK ROUTES
========================================================================= */
router.post("/payment-success", paymentSuccess);
router.post("/payment-fail", paymentFail);
router.post("/payment-cancel", paymentCancel);
router.post("/payment-ipn", paymentIpn);

/* =========================================================================
   STORE OWNER — ORDER ROUTES
========================================================================= */
router.get("/store-orders", verifyStoreOwnerJWT, getStoreOrders);
router.get("/store-order-stats", verifyStoreOwnerJWT, getOrderStats);
router.get("/store-order/:id", verifyStoreOwnerJWT, getStoreOrderById);
router.put("/update-order-status/:id", verifyStoreOwnerJWT, updateOrderStatus);

/* =========================================================================
   STORE OWNER — SALES REPORT ROUTES
========================================================================= */
router.get("/sales/overview", verifyStoreOwnerJWT, getSalesOverview);
router.get("/sales/revenue-chart", verifyStoreOwnerJWT, getRevenueChart);
router.get("/sales/top-products", verifyStoreOwnerJWT, getTopProducts);
router.get("/sales/recent-orders", verifyStoreOwnerJWT, getRecentOrders);
router.get("/sales/payment-breakdown", verifyStoreOwnerJWT, getPaymentBreakdown);
router.get("/sales/by-category", verifyStoreOwnerJWT, getSalesByCategory);

module.exports = router;