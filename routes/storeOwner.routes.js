// routes/storeOwner.routes.js
const express = require("express");
const router = express.Router();
const {
  registerStoreOwner,
  loginStoreOwner,
  getCurrentStoreOwner,
  getAllStoreOwners,
  getStoreOwnerById,
  createStoreOwnerByAdmin,
  updateStoreOwnerByAdmin,
  toggleStoreOwnerStatus,
  deleteStoreOwner,
  getStoreOwnerStats,
} = require("../controller/storeOwner.controller");
const verifyJWT = require("../middleware/verifyJWT");

/* =========================================================================
   PUBLIC ROUTES (no authentication)
========================================================================= */
router.post("/register-store-owner", registerStoreOwner);
router.post("/login-store-owner", loginStoreOwner);

/* =========================================================================
   STORE OWNER ROUTES (JWT required — for the logged-in store owner)
========================================================================= */
router.get("/me", verifyJWT, getCurrentStoreOwner);

/* =========================================================================
   SUPER ADMIN ROUTES (JWT required — manage all store owners)
========================================================================= */
router.get("/get-all-store-owners", verifyJWT, getAllStoreOwners);
router.get("/get-store-owner-stats", verifyJWT, getStoreOwnerStats);
router.get("/get-store-owner/:id", verifyJWT, getStoreOwnerById);
router.post("/create-store-owner", verifyJWT, createStoreOwnerByAdmin);
router.put("/update-store-owner/:id", verifyJWT, updateStoreOwnerByAdmin);
router.put("/toggle-store-owner-status/:id", verifyJWT, toggleStoreOwnerStatus);
router.delete("/delete-store-owner/:id", verifyJWT, deleteStoreOwner);

module.exports = router;