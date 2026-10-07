// controller/manualPayment.controller.js
const { Op } = require("sequelize");
const ManualPayment = require("../models/manualPayment.model");
const Store = require("../models/store.model");
const Package = require("../models/package.model");
const PaymentChannel = require("../models/paymentChannel.model");
const sequelize = require("../database/connection");

/* =========================================================================
   Helpers
========================================================================= */
const generatePaymentCode = async () => {
  const year = new Date().getFullYear();
  const count = await ManualPayment.count();
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};

/* =========================================================================
   SUBMIT MANUAL PAYMENT (store owner)
========================================================================= */
const submitManualPayment = async (req, res, next) => {
  try {
    const {
      storeId,
      packageId,
      channelId,
      accountNumber,
      senderAccountNumber,
      transactionId,
      paymentDate,
      screenshot,
      notes,
    } = req.body;

    if (!storeId || !packageId || !channelId || !transactionId || !accountNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Store, package, channel, account number and transaction ID are required!",
      });
    }

    // Verify store exists
    const store = await Store.findOne({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    // Verify package
    const pkg = await Package.findOne({ where: { id: packageId } });
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    // Verify channel
    const channel = await PaymentChannel.findOne({
      where: { id: channelId, isActive: true },
    });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Payment channel not found or inactive!",
      });
    }

    // Prevent duplicate TrxID
    const duplicate = await ManualPayment.findOne({
      where: { transactionId, status: { [Op.ne]: "REJECTED" } },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "This transaction ID has already been submitted!",
      });
    }

    // Prevent duplicate pending for same store
    const pendingExists = await ManualPayment.findOne({
      where: { storeId, status: "PENDING" },
    });
    if (pendingExists) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending payment. Please wait for verification.",
      });
    }

    const paymentCode = await generatePaymentCode();

    const payment = await ManualPayment.create({
      paymentCode,
      storeId,
      packageId,
      channelId,
      amount: pkg.price,
      currency: pkg.currency,
      accountNumber,
      senderAccountNumber: senderAccountNumber || null,
      transactionId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      screenshot: screenshot || null,
      status: "PENDING",
      notes: notes || null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Payment submitted successfully! Our team will verify it shortly.",
      data: payment,
    });
  } catch (error) {
    console.error("Error submitting manual payment:", error);
    next(error);
  }
};

/* =========================================================================
   GET STORE PAYMENTS
========================================================================= */
const getStoreManualPayments = async (req, res, next) => {
  try {
    const { storeId } = req.params;

    const payments = await ManualPayment.findAll({
      where: { storeId },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Payments retrieved successfully!",
      data: payments,
    });
  } catch (error) {
    console.error("Error getting store payments:", error);
    next(error);
  }
};

/* =========================================================================
   GET PAYMENT BY ID
========================================================================= */
const getManualPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await ManualPayment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Payment retrieved successfully!",
      data: payment,
    });
  } catch (error) {
    console.error("Error getting payment:", error);
    next(error);
  }
};




































// =========================================================================
//! GET ALL MANUAL PAYMENTS (super admin — with filters)
// =========================================================================
const getAllManualPayments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "",
      search = "",
      storeId = "",
      channelId = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (status) whereClause.status = status;
    if (storeId) whereClause.storeId = storeId;
    if (channelId) whereClause.channelId = channelId;

    if (search) {
      whereClause[Op.or] = [
        { paymentCode: { [Op.like]: `%${search}%` } },
        { transactionId: { [Op.like]: `%${search}%` } },
        { accountNumber: { [Op.like]: `%${search}%` } },
        { senderAccountNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) whereClause.createdAt[Op.lte] = new Date(dateTo + "T23:59:59");
    }

    const { count, rows: payments } = await ManualPayment.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [
        // PENDING first, then by createdAt desc
        ["status", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Manually attach store, package, channel (no associations)
    const enriched = await Promise.all(
      payments.map(async (p) => {
        const data = p.toJSON();
        const [store, pkg, channel] = await Promise.all([
          Store.findOne({ where: { id: data.storeId } }),
          Package.findOne({ where: { id: data.packageId } }),
          PaymentChannel.findOne({ where: { id: data.channelId } }),
        ]);
        return {
          ...data,
          store: store
            ? {
                id: store.id,
                name: store.name,
                slug: store.slug,
                status: store.status,
                email: store.email,
                phone: store.phone,
              }
            : null,
          package: pkg
            ? {
                id: pkg.id,
                name: pkg.name,
                price: pkg.price,
                currency: pkg.currency,
                durationDay: pkg.durationDay,
              }
            : null,
          channel: channel
            ? {
                id: channel.id,
                name: channel.name,
                accountType: channel.accountType,
                accountNumber: channel.accountNumber,
              }
            : null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Payments retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting all payments:", error);
    next(error);
  }
};

// =========================================================================
//! GET PAYMENT STATS (super admin)
// =========================================================================
const getManualPaymentStats = async (req, res, next) => {
  try {
    const total = await ManualPayment.count();
    const pending = await ManualPayment.count({ where: { status: "PENDING" } });
    const verified = await ManualPayment.count({ where: { status: "VERIFIED" } });
    const rejected = await ManualPayment.count({ where: { status: "REJECTED" } });

    const totalVerifiedAmount = await ManualPayment.sum("amount", {
      where: { status: "VERIFIED" },
    });

    return res.status(200).json({
      success: true,
      message: "Stats retrieved successfully!",
      data: {
        total,
        pending,
        verified,
        rejected,
        totalVerifiedAmount: totalVerifiedAmount || 0,
      },
    });
  } catch (error) {
    console.error("Error getting payment stats:", error);
    next(error);
  }
};

// =========================================================================
//! VERIFY MANUAL PAYMENT (approve → activate store + create subscription)
// =========================================================================
const verifyManualPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { notes } = req.body;

    const payment = await ManualPayment.findOne({
      where: { id },
      transaction,
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    if (payment.status !== "PENDING") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status.toLowerCase()}!`,
      });
    }

    /* ---------- Fetch related records ---------- */
    const store = await Store.findOne({
      where: { id: payment.storeId },
      transaction,
    });
    if (!store) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    const pkg = await Package.findOne({
      where: { id: payment.packageId },
      transaction,
    });
    if (!pkg) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    /* ---------- Compute subscription window ---------- */
    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(endAt.getDate() + Number(pkg.durationDay || 30));

    /* ---------- Update payment ---------- */
    await payment.update(
      {
        status: "VERIFIED",
        verifiedBy: req.user?.id || null,
        verifiedAt: new Date(),
        notes: notes ? `${payment.notes || ""}\n${notes}`.trim() : payment.notes,
      },
      { transaction }
    );

    /* ---------- Activate store ---------- */
    await store.update(
      {
        status: "ACTIVE",
        packageId: pkg.id,
        subscriptionStartAt: startAt,
        subscriptionEndAt: endAt,
      },
      { transaction }
    );

    /* ---------- Create subscription record ---------- */
    const Subscription = require("../models/subscription.model");
    await Subscription.create(
      {
        storeId: store.id,
        packageId: pkg.id,
        manualPaymentId: payment.id,
        startAt,
        endAt,
        durationDay: pkg.durationDay,
        price: payment.amount,
        currency: payment.currency || "BDT",
        status: "ACTIVE",
        isRenewal: !!store.subscriptionEndAt,
        notes: notes || null,
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await transaction.commit();

    /* ---------- Post-commit: reload for response ---------- */
    const updatedPayment = await ManualPayment.findOne({ where: { id } });
    const updatedStore = await Store.findOne({ where: { id: store.id } });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully! Store is now active.",
      data: {
        payment: updatedPayment,
        store: updatedStore,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        console.error("Rollback failed:", rbErr);
      }
    }
    console.error("Error verifying payment:", error);
    next(error);
  }
};

// =========================================================================
//! REJECT MANUAL PAYMENT
// =========================================================================
const rejectManualPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required!",
      });
    }

    const payment = await ManualPayment.findOne({ where: { id } });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found!",
      });
    }

    if (payment.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status.toLowerCase()}!`,
      });
    }

    await payment.update({
      status: "REJECTED",
      verifiedBy: req.user?.id || null,
      verifiedAt: new Date(),
      rejectionReason: rejectionReason.trim(),
    });

    const updated = await ManualPayment.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Payment rejected successfully!",
      data: updated,
    });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    next(error);
  }
};

module.exports = {
  submitManualPayment,
  getStoreManualPayments,
  getManualPaymentById,


   getAllManualPayments,      
  getManualPaymentStats,    
  verifyManualPayment,      
  rejectManualPayment,
};