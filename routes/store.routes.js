// routes/store.routes.js
const express = require("express");
const router = express.Router();
const {
  getAllStores,
  getStoreById,
  getStoreBySlug,
  toggleStoreStatus,
  updateStore,
  deleteStore,
  getStoreStats,
  getPublicStores,
} = require("../controller/storeManagement.controller");
const verifyJWT = require("../middleware/verifyJWT");

/* =========================================================================
   PUBLIC ROUTES (no authentication) — for storefront
========================================================================= */
router.get("/public/store/:slug", getStoreBySlug);

/* =========================================================================
   SUPER ADMIN ROUTES (JWT required)
========================================================================= */
router.get("/get-all-stores", verifyJWT, getAllStores);
router.get("/get-store-stats", verifyJWT, getStoreStats);
router.get("/get-store/:id", verifyJWT, getStoreById);
router.put("/update-store/:id", verifyJWT, updateStore);
router.put("/toggle-store-status/:id", verifyJWT, toggleStoreStatus);
router.delete("/delete-store/:id", verifyJWT, deleteStore);

router.get("/public/stores", getPublicStores);

module.exports = router;