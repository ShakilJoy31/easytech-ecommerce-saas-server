const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/superAdmin.model");

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided."
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
          message: "Session Expired! Please login again."
        });
      }
      
      if (!decoded?.id) {
        return res.status(401).json({
          success: false,
          message: "Invalid token!"
        });
      }
      
      try {
        const user = await SuperAdmin.findOne({ 
          where: { id: decoded.id },
          attributes: { exclude: ['password'] }
        });
        
        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found!"
          });
        }

        // Check if user is active
        if (user.status !== 'active') {
          return res.status(403).json({
            success: false,
            message: "Account is not active. Please contact administrator."
          });
        }

        // Attach user info to request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          fullName: user.fullName
        };
        
        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Server error during authentication."
        });
      }
    }
  );
};

module.exports = verifyJWT;