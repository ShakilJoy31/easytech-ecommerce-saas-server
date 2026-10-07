const ServerStatus = require("../models/serverStatus.model");

//! Toggle server status (active/inactive)
const toggleServerStatus = async (req, res, next) => {
  try {
    // Get the first record or create default if none exists
    let serverStatus = await ServerStatus.findOne({
      order: [['id', 'ASC']]
    });

    // If no record exists, create a default one
    if (!serverStatus) {
      serverStatus = await ServerStatus.create({
        status: "active"
      });
    }

    // Toggle the status
    const newStatus = serverStatus.status === "active" ? "inactive" : "active";
    
    await serverStatus.update({
      status: newStatus
    });

    return res.status(200).json({
      success: true,
      message: `Server ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`,
      data: {
        status: newStatus
      }
    });
  } catch (error) {
    console.error('Toggle Server Status Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle server status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Get current server status
const getServerStatus = async (req, res, next) => {
  try {
    // Get the first record or create default if none exists
    let serverStatus = await ServerStatus.findOne({
      order: [['id', 'ASC']]
    });

    // If no record exists, create a default one
    if (!serverStatus) {
      serverStatus = await ServerStatus.create({
        status: "active"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        status: serverStatus.status
      }
    });
  } catch (error) {
    console.error('Get Server Status Error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to get server status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//! Middleware to check if server is active
const checkServerStatus = async (req, res, next) => {
  try {
    // Skip status check for health endpoint and server status API
    if (req.path === '/health' || req.path === '/server-status' || req.path === '/server-status/toggle') {
      return next();
    }

    // Get server status
    let serverStatus = await ServerStatus.findOne({
      order: [['id', 'ASC']]
    });

    // If no record exists, create default
    if (!serverStatus) {
      serverStatus = await ServerStatus.create({
        status: "active"
      });
    }

    // If server is inactive, block the request
    if (serverStatus.status === "inactive") {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please contact support.",
        status: "inactive"
      });
    }

    next();
  } catch (error) {
    console.error('Check Server Status Error:', error);
    // If there's an error checking status, allow the request to proceed
    next();
  }
};

module.exports = {
  toggleServerStatus,
  getServerStatus,
  checkServerStatus
};

