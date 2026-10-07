// routes/package.routes.js
const express = require("express");
const router = express.Router();
const {
  createPackage,
  getAllPackages,
  getPublicPackages,
  getPackageById,
  getPackageBySlug,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  reorderPackages,
  getPackageStats,
} = require("../controller/package.controller");
const verifyJWT = require("../middleware/verifyJWT");

//! Public routes (no authentication)
router.get("/public/packages", getPublicPackages);
router.get("/public/packages/slug/:slug", getPackageBySlug);

//! Protected routes (authentication required — super admin only)
router.post("/create-package", verifyJWT, createPackage);
router.get("/get-packages", verifyJWT, getAllPackages);
router.get("/get-package/:id", getPackageById);
router.put("/update-package/:id", verifyJWT, updatePackage);
router.delete("/delete-package/:id", verifyJWT, deletePackage);
router.put("/toggle-package-status/:id", verifyJWT, togglePackageStatus);
router.put("/reorder-packages", verifyJWT, reorderPackages);
router.get("/get-package-stats", verifyJWT, getPackageStats);

module.exports = router;