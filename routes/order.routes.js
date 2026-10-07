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
const verifyStoreOwnerJWT = require("../middleware/verifyStoreOwnerJWT");

/* =========================================================================
   PUBLIC ROUTES (customer checkout — no auth)
========================================================================= */
router.post("/create-order", createOrder);
router.get("/status/:tran_id", getOrderByTransactionId);

/* =========================================================================
   SSL CALLBACK ROUTES (called by SSLCommerz — no auth)
========================================================================= */
router.post("/payment-success", paymentSuccess);
router.post("/payment-fail", paymentFail);
router.post("/payment-cancel", paymentCancel);
router.post("/payment-ipn", paymentIpn);

/* =========================================================================
   STORE OWNER ROUTES (JWT required)
========================================================================= */
router.get("/store-orders", verifyStoreOwnerJWT, getStoreOrders);
router.get("/store-order-stats", verifyStoreOwnerJWT, getOrderStats);
router.get("/store-order/:id", verifyStoreOwnerJWT, getStoreOrderById);
router.put("/update-order-status/:id", verifyStoreOwnerJWT, updateOrderStatus);

module.exports = router;