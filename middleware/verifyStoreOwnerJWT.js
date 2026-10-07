// middleware/verifyStoreOwnerJWT.js
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Store = require("../models/store.model");

const verifyStoreOwnerJWT = (req, res, next) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  const access_token = authHeader.split(" ")[1];

  jwt.verify(
    access_token,
    process.env.JWT_ACCESS_TOKEN,
    async (error, decoded) => {
      if (error) {
        return res.status(401).json({
          success: false,
          message: "Session Expired! Please login again.",
        });
      }

      if (!decoded?.id) {
        return res.status(401).json({
          success: false,
          message: "Invalid token!",
        });
      }

      try {
        const user = await User.findOne({
          where: { id: decoded.id },
          attributes: { exclude: ["password"] },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found!",
          });
        }

        // Must be a store owner
        if (user.role !== "STORE_OWNER") {
          return res.status(403).json({
            success: false,
            message: "Access denied. Store owner role required.",
          });
        }

        // Must be active
        if (!user.isActive) {
          return res.status(403).json({
            success: false,
            message: "Account is inactive. Please contact support.",
          });
        }

        // Must have a store
        if (!user.storeId) {
          return res.status(403).json({
            success: false,
            message: "No store linked to this account.",
          });
        }

        // Verify store exists and is active
        const store = await Store.findOne({ where: { id: user.storeId } });
        if (!store) {
          return res.status(404).json({
            success: false,
            message: "Store not found!",
          });
        }

        if (store.status !== "ACTIVE") {
          return res.status(403).json({
            success: false,
            message: `Your store is ${store.status.toLowerCase()}. Please contact support.`,
          });
        }

        // Attach user + store to request
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          storeId: user.storeId,
          isActive: user.isActive,
        };
        req.store = {
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          packageId: store.packageId,
          subscriptionEndAt: store.subscriptionEndAt,
        };

        next();
      } catch (error) {
        console.error("Store owner JWT error:", error);
        return res.status(500).json({
          success: false,
          message: "Server error during authentication.",
        });
      }
    }
  );
};

module.exports = verifyStoreOwnerJWT;