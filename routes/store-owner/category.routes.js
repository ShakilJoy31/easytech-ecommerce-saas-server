// routes/category.routes.js
const express = require("express");
const router = express.Router();
const verifyStoreOwnerJWT = require("../../middleware/verifyStoreOwnerJWT");
const { createCategory, getAllCategories, getCategoryStats, getCategoryOptions, getCategoryById, updateCategory, toggleCategoryStatus, deleteCategory } = require("../../controller/store-owner/category.controller");

/* =========================================================================
   ALL ROUTES REQUIRE STORE OWNER JWT
   Every query inside the controller is auto-scoped by req.user.storeId
========================================================================= */

router.post("/create-category", verifyStoreOwnerJWT, createCategory);
router.get("/get-categories", verifyStoreOwnerJWT, getAllCategories);
router.get("/get-category-stats", verifyStoreOwnerJWT, getCategoryStats);
router.get("/get-category-options", verifyStoreOwnerJWT, getCategoryOptions);
router.get("/get-category/:id", verifyStoreOwnerJWT, getCategoryById);
router.put("/update-category/:id", verifyStoreOwnerJWT, updateCategory);
router.put("/toggle-category-status/:id", verifyStoreOwnerJWT, toggleCategoryStatus);
router.delete("/delete-category/:id", verifyStoreOwnerJWT, deleteCategory);

module.exports = router;