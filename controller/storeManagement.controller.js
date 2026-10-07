// controller/storeManagement.controller.js
const { Op } = require("sequelize");
const Store = require("../models/store.model");
const User = require("../models/user.model");
const Package = require("../models/package.model");
const Subscription = require("../models/subscription.model");
const Product = require("../models/store-owner/product.model");

/* =========================================================================
   Helpers
========================================================================= */
const enrichStore = async (store, includeOwner = true, includePackage = true) => {
  const data = store.toJSON ? store.toJSON() : store;

  let owner = null;
  if (includeOwner && data.ownerId) {
    const u = await User.findOne({
      where: { id: data.ownerId },
      attributes: { exclude: ["password"] },
    });
    if (u) {
      const ud = u.toJSON();
      owner = {
        id: ud.id,
        name: ud.name,
        email: ud.email,
        phone: ud.phone,
        isActive: ud.isActive,
        role: ud.role,
        createdAt: ud.createdAt,
        lastLoginAt: ud.lastLoginAt,
      };
    }
  }

  let pkg = null;
  if (includePackage && data.packageId) {
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
        maxOrdersPerMonth: pd.maxOrdersPerMonth,
      };
    }
  }

  // Compute subscription days remaining
  const now = new Date();
  const endAt = data.subscriptionEndAt ? new Date(data.subscriptionEndAt) : null;
  const isExpired = endAt ? endAt < now : false;
  const daysRemaining =
    endAt && !isExpired
      ? Math.ceil((endAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  return {
    ...data,
    isExpired,
    daysRemaining,
    owner,
    package: pkg,
  };
};

/* =========================================================================
   GET ALL STORES (super admin)
========================================================================= */
const getAllStores = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      packageId = "",
      district = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (status) whereClause.status = status;
    if (packageId) whereClause.packageId = packageId;
    if (district) whereClause.district = { [Op.like]: `%${district}%` };

    // Search by store name/code/slug OR by owner name/email/phone
    if (search) {
      const matchingOwners = await User.findAll({
        where: {
          role: "STORE_OWNER",
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phone: { [Op.like]: `%${search}%` } },
          ],
        },
        attributes: ["id"],
      });
      const ownerIds = matchingOwners.map((o) => o.id);

      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { storeCode: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { ownerId: { [Op.in]: ownerIds.length ? ownerIds : [0] } },
      ];
    }

    const { count, rows: stores } = await Store.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    const enriched = await Promise.all(
      stores.map((s) => enrichStore(s, true, true))
    );

    return res.status(200).json({
      success: true,
      message: "Stores retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting stores:", error);
    next(error);
  }
};

/* =========================================================================
   GET STORE BY ID (super admin — full details)
========================================================================= */
const getStoreById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const store = await Store.findOne({ where: { id } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    const enriched = await enrichStore(store, true, true);

    // Also grab subscriptions history for this store
    const subs = await Subscription.findAll({
      where: { storeId: id },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    const subsEnriched = await Promise.all(
      subs.map(async (sub) => {
        const sd = sub.toJSON();
        let pkg = null;
        if (sd.packageId) {
          const p = await Package.findOne({ where: { id: sd.packageId } });
          if (p) {
            const pd = p.toJSON();
            pkg = {
              id: pd.id,
              name: pd.name,
              price: pd.price,
              currency: pd.currency,
              durationDay: pd.durationDay,
            };
          }
        }
        return { ...sd, package: pkg };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Store retrieved successfully!",
      data: {
        ...enriched,
        recentSubscriptions: subsEnriched,
      },
    });
  } catch (error) {
    console.error("Error getting store:", error);
    next(error);
  }
};

/* =========================================================================
   GET STORE BY SLUG (public — for storefront)
========================================================================= */
const getStoreBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const store = await Store.findOne({ where: { slug } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    // Only return ACTIVE stores to the public
    if (store.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This store is not active.",
      });
    }

    const enriched = await enrichStore(store, false, true);
    return res.status(200).json({
      success: true,
      message: "Store retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting store by slug:", error);
    next(error);
  }
};

/* =========================================================================
   TOGGLE STORE STATUS (super admin)
========================================================================= */
const toggleStoreStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const store = await Store.findOne({ where: { id } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"];
    const newStatus =
      status && validStatuses.includes(status)
        ? status
        : store.status === "ACTIVE"
        ? "SUSPENDED"
        : "ACTIVE";

    await store.update({
      status: newStatus,
      updatedBy: req.user?.id || null,
    });

    const updated = await Store.findOne({ where: { id } });
    const enriched = await enrichStore(updated, true, true);

    return res.status(200).json({
      success: true,
      message: `Store status changed to ${newStatus}`,
      data: enriched,
    });
  } catch (error) {
    console.error("Error toggling store status:", error);
    next(error);
  }
};

/* =========================================================================
   UPDATE STORE (super admin)
========================================================================= */
const updateStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const store = await Store.findOne({ where: { id } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    // Slug uniqueness check
    if (updateData.slug && updateData.slug !== store.slug) {
      const exists = await Store.findOne({
        where: { slug: updateData.slug, id: { [Op.ne]: id } },
      });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "This slug is already taken!",
        });
      }
    }

    // Whitelist editable fields
    const allowed = [
      "name",
      "slug",
      "tagline",
      "description",
      "logo",
      "banner",
      "email",
      "phone",
      "address",
      "district",
      "country",
      "primaryColor",
      "secondaryColor",
      "facebook",
      "instagram",
      "whatsapp",
      "status",
      "subscriptionStartAt",
      "subscriptionEndAt",
    ];

    const cleanUpdate = {};
    for (const key of allowed) {
      if (updateData[key] !== undefined) cleanUpdate[key] = updateData[key];
    }
    cleanUpdate.updatedBy = req.user?.id || null;

    await store.update(cleanUpdate);

    const updated = await Store.findOne({ where: { id } });
    const enriched = await enrichStore(updated, true, true);

    return res.status(200).json({
      success: true,
      message: "Store updated successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error updating store:", error);
    next(error);
  }
};

/* =========================================================================
   DELETE STORE (super admin)
   ⚠️ This deletes the store only. Owner user remains unless deleted separately.
========================================================================= */
const deleteStore = async (req, res, next) => {
  try {
    const { id } = req.params;

    const store = await Store.findOne({ where: { id } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    const ownerId = store.ownerId;

    await Store.destroy({ where: { id } });

    // Detach owner from store
    if (ownerId) {
      await User.update({ storeId: null }, { where: { id: ownerId } });
    }

    return res.status(200).json({
      success: true,
      message: "Store deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting store:", error);
    next(error);
  }
};

/* =========================================================================
   STORE STATS (super admin dashboard)
========================================================================= */
const getStoreStats = async (req, res, next) => {
  try {
    const total = await Store.count();
    const active = await Store.count({ where: { status: "ACTIVE" } });
    const inactive = await Store.count({ where: { status: "INACTIVE" } });
    const suspended = await Store.count({ where: { status: "SUSPENDED" } });
    const expired = await Store.count({ where: { status: "EXPIRED" } });

    // Expiring soon (next 7 days)
    const now = new Date();
    const sevenDays = new Date();
    sevenDays.setDate(sevenDays.getDate() + 7);

    const expiringSoon = await Store.count({
      where: {
        status: "ACTIVE",
        subscriptionEndAt: {
          [Op.between]: [now, sevenDays],
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Store stats retrieved successfully!",
      data: {
        total,
        active,
        inactive,
        suspended,
        expired,
        expiringSoon,
      },
    });
  } catch (error) {
    console.error("Error getting store stats:", error);
    next(error);
  }
};









// =========================================================================
//! GET PUBLIC STORES (no auth — for home page)
// =========================================================================
const getPublicStores = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      district = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = { status: "ACTIVE" };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }

    if (district) {
      whereClause.district = { [Op.like]: `%${district}%` };
    }

    const { count, rows: stores } = await Store.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "storeCode",
        "name",
        "slug",
        "tagline",
        "logo",
        "banner",
        "district",
        "primaryColor",
        "secondaryColor",
      ],
    });


    const enriched = await Promise.all(
      stores.map(async (s) => {
        const data = s.toJSON();
        const productCount = await Product.count({
          where: { storeId: s.id, isActive: true },
        });
        return { ...data, productCount };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Public stores retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting public stores:", error);
    next(error);
  }
};



module.exports = {
  getAllStores,
  getStoreById,
  getStoreBySlug,
  toggleStoreStatus,
  updateStore,
  deleteStore,
  getStoreStats,
  getPublicStores
};