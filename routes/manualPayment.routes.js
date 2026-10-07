// routes/manualPayment.routes.js
const express = require("express");
const router = express.Router();
const {
  submitManualPayment,
  getStoreManualPayments,
  getManualPaymentById,
  getAllManualPayments,
  getManualPaymentStats,
  verifyManualPayment,
  rejectManualPayment,
} = require("../controller/manualPayment.controller");
const verifyJWT = require("../middleware/verifyJWT");

//! Store owner routes (JWT required)
router.post("/submit-payment", submitManualPayment);
router.get("/get-store-payments/:storeId", getStoreManualPayments);
router.get("/get-payment/:id", verifyJWT, getManualPaymentById);



//! Super admin routes (JWT required)
router.get("/get-all-payments", verifyJWT, getAllManualPayments);
router.get("/get-payment-stats", verifyJWT, getManualPaymentStats);
router.put("/verify-payment/:id", verifyJWT, verifyManualPayment);
router.put("/reject-payment/:id", verifyJWT, rejectManualPayment);

module.exports = router;