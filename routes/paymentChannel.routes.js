// routes/paymentChannel.routes.js
const express = require("express");
const router = express.Router();
const {
  createPaymentChannel,
  getAllPaymentChannels,
  getPublicPaymentChannels,
  getPaymentChannelById,
  updatePaymentChannel,
  deletePaymentChannel,
  togglePaymentChannelStatus,
  getPaymentChannelStats,
} = require("../controller/paymentChannel.controller");
const verifyJWT = require("../middleware/verifyJWT");

//! Public routes
router.get("/public/channels", getPublicPaymentChannels);

//! Protected routes (super admin)
router.post("/create-channel", verifyJWT, createPaymentChannel);
router.get("/get-channels", verifyJWT, getAllPaymentChannels);
router.get("/get-channel/:id", verifyJWT, getPaymentChannelById);
router.put("/update-channel/:id", verifyJWT, updatePaymentChannel);
router.delete("/delete-channel/:id", verifyJWT, deletePaymentChannel);
router.put("/toggle-channel-status/:id", verifyJWT, togglePaymentChannelStatus);
router.get("/get-channel-stats", verifyJWT, getPaymentChannelStats);

module.exports = router;