const express = require("express");
const router = express.Router();
const { createBrotherEnterprise, checkBrotherEnterpriseCredentials, getPendingBrotherEnterpriseForActivation, getAllBrotherEnterprises, getBrotherEnterpriseById, updateBrotherEnterprise, deleteBrotherEnterprise, updateBrotherEnterpriseStatus, changeBrotherEnterprisePassword, getBrotherEnterpriseStats } = require("../controller/superadmin.controller");
const verifyJWT = require("../middleware/verifyJWT");

//! Public routes (no authentication required)
router.post("/register-super-admin", createBrotherEnterprise);
router.post("/login-super-admin", checkBrotherEnterpriseCredentials);
router.get("/get-pending-enterprise-for-activation/:id", getPendingBrotherEnterpriseForActivation);

//! Protected routes (authentication required)
router.get("/get-enterprises", verifyJWT, getAllBrotherEnterprises);
router.get("/get-enterprise/:id", verifyJWT, getBrotherEnterpriseById);
router.put("/update-enterprise/:id", verifyJWT, updateBrotherEnterprise);
router.delete("/delete-enterprise/:id", verifyJWT, deleteBrotherEnterprise);
router.put("/update-super-admin-status/:id", verifyJWT, updateBrotherEnterpriseStatus);
router.put("/change-enterprise-password/:id", verifyJWT, changeBrotherEnterprisePassword);
router.get("/get-enterprise-stats", verifyJWT, getBrotherEnterpriseStats);

module.exports = router;