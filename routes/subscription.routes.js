// routes/subscription.routes.js
const express = require("express");
const router = express.Router();
const {
  getAllSubscriptions,
  getSubscriptionById,
  getSubscriptionsByStore,
  getSubscriptionStats,
  cancelSubscription,
  expireOutdatedSubscriptions,
} = require("../controller/subscription.controller");
const verifyJWT = require("../middleware/verifyJWT");

/* =========================================================================
   SUPER ADMIN ROUTES (JWT required)
========================================================================= */
router.get("/get-all-subscriptions", verifyJWT, getAllSubscriptions);
router.get("/get-subscription-stats", verifyJWT, getSubscriptionStats);
router.get("/get-subscription/:id", verifyJWT, getSubscriptionById);
router.get("/get-store-subscriptions/:storeId", verifyJWT, getSubscriptionsByStore);
router.put("/cancel-subscription/:id", verifyJWT, cancelSubscription);
router.post("/expire-outdated", verifyJWT, expireOutdatedSubscriptions);

module.exports = router;