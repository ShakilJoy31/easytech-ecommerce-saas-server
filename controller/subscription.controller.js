// controller/subscription.controller.js
const { Op } = require("sequelize");
const Subscription = require("../models/subscription.model");
const Store = require("../models/store.model");
const Package = require("../models/package.model");
const ManualPayment = require("../models/manualPayment.model");
const sequelize = require("../database/connection");

/* =========================================================================
   Helpers
========================================================================= */
const transformSubscription = async (sub, includeRelations = true) => {
  const data = sub.toJSON ? sub.toJSON() : sub;

  // Human-readable duration
  const durationLabel =
    data.durationDay === 30
      ? "Monthly"
      : data.durationDay === 365
      ? "Yearly"
      : data.durationDay === 7
      ? "Weekly"
      : `${data.durationDay} days`;

  // Compute remaining days
  const now = new Date();
  const endAt = data.endAt ? new Date(data.endAt) : null;
  const isExpired = endAt ? endAt < now : false;
  const daysRemaining =
    endAt && !isExpired
      ? Math.ceil((endAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  const base = {
    ...data,
    durationLabel,
    isExpired,
    daysRemaining,
  };

  if (!includeRelations) return base;

  /* ---------- Fetch related records separately ---------- */
  let store = null;
  if (data.storeId) {
    const s = await Store.findOne({ where: { id: data.storeId } });
    if (s) {
      const sd = s.toJSON();
      store = {
        id: sd.id,
        storeCode: sd.storeCode,
        name: sd.name,
        slug: sd.slug,
        status: sd.status,
        email: sd.email,
        phone: sd.phone,
        logo: sd.logo,
        subscriptionStartAt: sd.subscriptionStartAt,
        subscriptionEndAt: sd.subscriptionEndAt,
      };
    }
  }

  let pkg = null;
  if (data.packageId) {
    const p = await Package.findOne({ where: { id: data.packageId } });
    if (p) {
      const pd = p.toJSON();
      pkg = {
        id: pd.id,
        name: pd.name,
        slug: pd.slug,
        price: pd.price,
        currency: pd.currency,
        durationDay: pd.durationDay,
        features: pd.features,
        maxProducts: pd.maxProducts,
        maxCategories: pd.maxCategories,
      };
    }
  }

  let payment = null;
  if (data.manualPaymentId) {
    const mp = await ManualPayment.findOne({
      where: { id: data.manualPaymentId },
    });
    if (mp) {
      const md = mp.toJSON();
      payment = {
        id: md.id,
        paymentCode: md.paymentCode,
        transactionId: md.transactionId,
        amount: md.amount,
        currency: md.currency,
        status: md.status,
        accountNumber: md.accountNumber,
        verifiedAt: md.verifiedAt,
      };
    }
  }

  return {
    ...base,
    store,
    package: pkg,
    manualPayment: payment,
  };
};

/* =========================================================================
   GET ALL SUBSCRIPTIONS (super admin)
========================================================================= */
const getAllSubscriptions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      storeId = "",
      packageId = "",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (status) whereClause.status = status;
    if (storeId) whereClause.storeId = storeId;
    if (packageId) whereClause.packageId = packageId;

    if (dateFrom || dateTo) {
      whereClause.startAt = {};
      if (dateFrom) whereClause.startAt[Op.gte] = new Date(dateFrom);
      if (dateTo)
        whereClause.startAt[Op.lte] = new Date(dateTo + "T23:59:59");
    }

    // Search by store name → need to look it up
    if (search) {
      // Find matching stores first
      const matchingStores = await Store.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { slug: { [Op.like]: `%${search}%` } },
            { storeCode: { [Op.like]: `%${search}%` } },
          ],
        },
        attributes: ["id"],
      });
      const storeIds = matchingStores.map((s) => s.id);

      // Find matching packages
      const matchingPackages = await Package.findAll({
        where: { name: { [Op.like]: `%${search}%` } },
        attributes: ["id"],
      });
      const packageIds = matchingPackages.map((p) => p.id);

      whereClause[Op.or] = [
        { storeId: { [Op.in]: storeIds.length ? storeIds : [0] } },
        { packageId: { [Op.in]: packageIds.length ? packageIds : [0] } },
      ];
    }

    const { count, rows: subs } = await Subscription.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const enriched = await Promise.all(
      subs.map((s) => transformSubscription(s, true))
    );

    return res.status(200).json({
      success: true,
      message: "Subscriptions retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting subscriptions:", error);
    next(error);
  }
};

/* =========================================================================
   GET SUBSCRIPTION BY ID
========================================================================= */
const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sub = await Subscription.findOne({ where: { id } });
    if (!sub) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found!",
      });
    }
    const enriched = await transformSubscription(sub, true);
    return res.status(200).json({
      success: true,
      message: "Subscription retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting subscription:", error);
    next(error);
  }
};

/* =========================================================================
   GET SUBSCRIPTIONS BY STORE
========================================================================= */
const getSubscriptionsByStore = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const subs = await Subscription.findAll({
      where: { storeId },
      order: [["createdAt", "DESC"]],
    });
    const enriched = await Promise.all(
      subs.map((s) => transformSubscription(s, true))
    );
    return res.status(200).json({
      success: true,
      message: "Store subscriptions retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting store subscriptions:", error);
    next(error);
  }
};

/* =========================================================================
   GET SUBSCRIPTION STATS (super admin)
========================================================================= */
const getSubscriptionStats = async (req, res, next) => {
  try {
    const total = await Subscription.count();
    const active = await Subscription.count({ where: { status: "ACTIVE" } });
    const expired = await Subscription.count({ where: { status: "EXPIRED" } });
    const pending = await Subscription.count({ where: { status: "PENDING" } });
    const cancelled = await Subscription.count({
      where: { status: "CANCELLED" },
    });

    // Total revenue from all ACTIVE subscriptions
    const totalRevenue = await Subscription.sum("price", {
      where: { status: "ACTIVE" },
    });

    // Active subscriptions expiring in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringSoon = await Subscription.count({
      where: {
        status: "ACTIVE",
        endAt: {
          [Op.between]: [new Date(), sevenDaysFromNow],
        },
      },
    });

    // Monthly recurring revenue approximation (only monthly plans counted fully)
    const now = new Date();
    const monthlyRevenue = await Subscription.sum("price", {
      where: {
        status: "ACTIVE",
        startAt: { [Op.lte]: now },
        endAt: { [Op.gte]: now },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Subscription stats retrieved successfully!",
      data: {
        total,
        active,
        expired,
        pending,
        cancelled,
        expiringSoon,
        totalRevenue: totalRevenue || 0,
        activeRevenue: monthlyRevenue || 0,
      },
    });
  } catch (error) {
    console.error("Error getting subscription stats:", error);
    next(error);
  }
};

/* =========================================================================
   CANCEL SUBSCRIPTION (super admin)
========================================================================= */
const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sub = await Subscription.findOne({ where: { id } });
    if (!sub) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found!",
      });
    }

    if (sub.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Subscription is already cancelled!",
      });
    }

    await sub.update({
      status: "CANCELLED",
      notes: reason
        ? `${sub.notes || ""}\nCancelled: ${reason}`.trim()
        : sub.notes,
      updatedBy: req.user?.id || null,
    });

    // If this was the store's current subscription, deactivate the store
    const store = await Store.findOne({ where: { id: sub.storeId } });
    if (store && store.status === "ACTIVE") {
      await store.update({ status: "SUSPENDED" });
    }

    const updated = await Subscription.findOne({ where: { id } });
    const enriched = await transformSubscription(updated, true);

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    next(error);
  }
};

/* =========================================================================
   EXPIRE SUBSCRIPTIONS (utility — can be run manually or via cron)
   Marks all subscriptions past endAt as EXPIRED and deactivates their stores.
========================================================================= */
const expireOutdatedSubscriptions = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const now = new Date();

    const outdatedSubs = await Subscription.findAll({
      where: {
        status: "ACTIVE",
        endAt: { [Op.lt]: now },
      },
      transaction,
    });

    let expiredCount = 0;
    let storesSuspended = 0;

    for (const sub of outdatedSubs) {
      await sub.update({ status: "EXPIRED" }, { transaction });
      expiredCount++;

      const store = await Store.findOne({
        where: { id: sub.storeId },
        transaction,
      });
      if (store && store.status === "ACTIVE") {
        await store.update({ status: "EXPIRED" }, { transaction });
        storesSuspended++;
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Expired ${expiredCount} subscription(s) and marked ${storesSuspended} store(s) as expired.`,
      data: { expiredCount, storesSuspended },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("Error expiring subscriptions:", error);
    next(error);
  }
};

module.exports = {
  getAllSubscriptions,
  getSubscriptionById,
  getSubscriptionsByStore,
  getSubscriptionStats,
  cancelSubscription,
  expireOutdatedSubscriptions,
};