const uploadWithMulter = require("../middleware/uploadWithMulter");

const serverStatusRoutes = require("../routes/serverStatus.routes");
const authenticationRoutes = require("../routes/superadmin.routes");
const packageRoutes = require("../routes/package.routes");
const storeOwnerRoutes = require("../routes/storeOwner.routes");
const paymentChannelRoutes = require("../routes/paymentChannel.routes");
const manualPaymentRoutes = require("../routes/manualPayment.routes");
const subscriptionRoutes = require("../routes/subscription.routes");
const storeRoutes = require("../routes/store.routes");
const categoryRoutes = require("../routes/store-owner/category.routes");

const router = require("express").Router();

//! Server status route On/Off
router.use("/server-status", serverStatusRoutes);

router.use("/authentication", authenticationRoutes);

router.use("/package", packageRoutes);

router.use("/store-owner", storeOwnerRoutes);

router.use("/payment-channel", paymentChannelRoutes);

router.use("/manual-payment", manualPaymentRoutes);

router.use("/subscription", subscriptionRoutes);

router.use("/store", storeRoutes);

router.use("/category", categoryRoutes);



//! File upload route
router.post("/file/upload", uploadWithMulter.single("image"), (req, res) => {
  try {
    if (!req.filelink) {
      return res.status(400).json({ 
        success: false,
        message: "File upload failed" 
      });
    }

    res.json({ 
      success: true,
      data: [req.filelink]
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Upload failed"
    });
  }
});



//! Document upload route
router.post("/document/upload", uploadWithMulter.uploadDocument.single("document"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    res.json({ 
      success: true,
      data: {
        filename: req.file.filename,
        path: `/uploads/documents/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Upload failed"
    });
  }
});

module.exports = router;