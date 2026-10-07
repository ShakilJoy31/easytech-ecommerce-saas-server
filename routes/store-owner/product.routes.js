// routes/product.routes.js
const express = require("express");
const verifyStoreOwnerJWT = require("../../middleware/verifyStoreOwnerJWT");
const { createProduct, getAllProducts, getProductStats, getProductById, updateProduct, toggleProductStatus, toggleProductFeatured, deleteProduct, getPublicProducts, getPublicProductById } = require("../../controller/store-owner/product.controller");
const router = express.Router();


/* =========================================================================
   ALL ROUTES REQUIRE STORE OWNER JWT
   Every query inside the controller is auto-scoped by req.user.storeId
========================================================================= */

router.post("/create-product", verifyStoreOwnerJWT, createProduct);
router.get("/get-products", verifyStoreOwnerJWT, getAllProducts);
router.get("/get-product-stats", verifyStoreOwnerJWT, getProductStats);
router.get("/get-product/:id", verifyStoreOwnerJWT, getProductById);
router.put("/update-product/:id", verifyStoreOwnerJWT, updateProduct);
router.put("/toggle-product-status/:id", verifyStoreOwnerJWT, toggleProductStatus);
router.put("/toggle-product-featured/:id", verifyStoreOwnerJWT, toggleProductFeatured);
router.delete("/delete-product/:id", verifyStoreOwnerJWT, deleteProduct);

router.get("/public/products", getPublicProducts);
router.get("/public/product/:id", getPublicProductById);

module.exports = router;