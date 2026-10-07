// controller/storeOwner.controller.js
const { Op } = require("sequelize");
const User = require("../models/user.model");
const Store = require("../models/store.model");
const Package = require("../models/package.model");
const sequelize = require("../database/connection");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middleware/jwtHelper");

/* =========================================================================
   Helpers
========================================================================= */

//! Strip sensitive fields
const sanitizeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : user;
  delete data.password;
  return data;
};

//! Generate a unique store slug
const generateUniqueSlug = async (name, transaction = null) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

  let slug = base || "store";
  let counter = 1;

  while (true) {
    const existing = await Store.findOne({
      where: { slug },
      transaction,
    });
    if (!existing) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
};

//! Generate human-readable store code
const generateStoreCode = async () => {
  const year = new Date().getFullYear();
  const count = await Store.count();
  return `STR-${year}-${String(count + 1).padStart(4, "0")}`;
};

/* =========================================================================
   REGISTER STORE OWNER
========================================================================= */
const registerStoreOwner = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      // Owner
      name,
      email,
      phone,
      password,

      // Store
      storeName,
      storeTagline,
      storeDescription,
      storePhone,
      storeEmail,
      storeAddress,
      storeDistrict,
      packageId,
    } = req.body;

    /* ==================== VALIDATION ==================== */

    if (!name || !email || !phone || !password) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required!",
      });
    }

    if (!storeName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Store name is required!",
      });
    }

    if (!packageId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please select a package!",
      });
    }

    if (String(password).length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long!",
      });
    }

    /* ==================== UNIQUENESS ==================== */

    const emailExists = await User.findOne({
      where: { email: email.trim().toLowerCase() },
      transaction,
    });
    if (emailExists) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    const phoneExists = await User.findOne({
      where: { phone: phone.trim() },
      transaction,
    });
    if (phoneExists) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    /* ==================== PACKAGE ==================== */

    const pkg = await Package.findOne({
      where: { id: packageId, isActive: true },
      transaction,
    });
    if (!pkg) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Selected package not found or is inactive!",
      });
    }

    /* ==================== CREATE USER ==================== */

    const newUser = await User.create(
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role: "STORE_OWNER",
        isActive: true,
      },
      { transaction }
    );

    /* ==================== CREATE STORE ==================== */

    const slug = await generateUniqueSlug(storeName, transaction);
    const storeCode = await generateStoreCode();

    const newStore = await Store.create(
      {
        storeCode,
        name: storeName.trim(),
        slug,
        tagline: storeTagline || null,
        description: storeDescription || null,
        logo: null,
        banner: null,

        email: storeEmail || email,
        phone: storePhone || phone,
        address: storeAddress || null,
        district: storeDistrict || null,
        country: "Bangladesh",

        ownerId: newUser.id,
        packageId: pkg.id,
        subscriptionStartAt: null,
        subscriptionEndAt: null,

        status: "INACTIVE",
        primaryColor: "#1d6fff",
        secondaryColor: "#0b2545",
      },
      { transaction }
    );

    /* ==================== LINK USER → STORE ==================== */

    await newUser.update({ storeId: newStore.id }, { transaction });

    /* ==================== COMMIT ==================== */

    await transaction.commit();

    /* ==================== POST-COMMIT WORK ==================== */

    // Simple fetch — no associations
    const safeUser = await User.findOne({
      where: { id: newUser.id },
      attributes: { exclude: ["password"] },
    });

    const safeStore = await Store.findOne({
      where: { id: newStore.id },
    });

    const safePackage = await Package.findOne({
      where: { id: pkg.id },
    });

    // Attach package manually to store
    const storeWithPackage = {
      ...safeStore.toJSON(),
      package: safePackage ? safePackage.toJSON() : null,
    };

    /* ==================== TOKENS ==================== */

    const tokenPayload = {
      id: newUser.id,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      storeId: newStore.id,
      storeSlug: newStore.slug,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    /* ==================== RESPOND ==================== */

    return res.status(201).json({
      success: true,
      message:
        "Store created successfully! Complete your payment to activate your store.",
      data: {
        user: safeUser,
        store: storeWithPackage,
        nextStep: "MANUAL_PAYMENT",
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    /* ==================== SAFE ROLLBACK ==================== */

    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
    }

    console.error("=== REGISTER STORE OWNER ERROR ===");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return next(error);
  }
};

/* =========================================================================
   LOGIN STORE OWNER
========================================================================= */
const loginStoreOwner = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/phone and password are required!",
      });
    }

    /* ---------- Find user by email OR phone ---------- */
    const user = await User.findOne({
      where: {
        role: "STORE_OWNER",
        [Op.or]: [
          { email: identifier.trim().toLowerCase() },
          { phone: identifier.trim() },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials!",
      });
    }

    /* ---------- Password ---------- */
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials!",
      });
    }

    /* ---------- User active? ---------- */
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact support.",
        accountInfo: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          status: "inactive",
        },
      });
    }

    /* ---------- Fetch store separately ---------- */
    let store = null;
    if (user.storeId) {
      store = await Store.findOne({ where: { id: user.storeId } });
    }

    if (!store) {
      return res.status(403).json({
        success: false,
        message: "No store is linked to your account. Please contact support.",
      });
    }

    /* ---------- Store status ---------- */
    if (store.status !== "ACTIVE") {
      let message = "Your store is not active yet.";
      if (store.status === "INACTIVE") {
        message =
          "Your store is awaiting payment verification. Please complete your payment or contact support.";
      } else if (store.status === "SUSPENDED") {
        message =
          "Your store has been suspended. Please contact support for assistance.";
      } else if (store.status === "EXPIRED") {
        message =
          "Your subscription has expired. Please renew your package to continue.";
      }

      return res.status(403).json({
        success: false,
        message,
        accountInfo: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          storeId: store.id,
          storeName: store.name,
          storeSlug: store.slug,
          status: store.status,
          subscriptionEndAt: store.subscriptionEndAt,
        },
      });
    }

    /* ---------- Subscription expiry ---------- */
    if (
      store.subscriptionEndAt &&
      new Date(store.subscriptionEndAt) < new Date()
    ) {
      await store.update({ status: "EXPIRED" });

      return res.status(403).json({
        success: false,
        message:
          "Your subscription has expired. Please renew your package to continue.",
        accountInfo: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          storeId: store.id,
          storeName: store.name,
          storeSlug: store.slug,
          status: "EXPIRED",
          subscriptionEndAt: store.subscriptionEndAt,
        },
      });
    }

    /* ---------- Fetch package separately ---------- */
    let pkg = null;
    if (store.packageId) {
      pkg = await Package.findOne({ where: { id: store.packageId } });
    }

    /* ---------- Update last login ---------- */
    await user.update({ lastLoginAt: new Date() });

    /* ---------- Tokens ---------- */
    const tokenPayload = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      storeId: store.id,
      storeSlug: store.slug,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    /* ---------- Sanitize + attach package ---------- */
    const safeUser = user.toJSON();
    delete safeUser.password;

    const storeWithPackage = {
      ...store.toJSON(),
      package: pkg ? pkg.toJSON() : null,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        user: safeUser,
        store: storeWithPackage,
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    console.error("Error logging in store owner:", error);
    next(error);
  }
};

/* =========================================================================
   GET CURRENT STORE OWNER (from token)
========================================================================= */
const getCurrentStoreOwner = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    const user = await User.findOne({
      where: { id: userId, role: "STORE_OWNER" },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Store owner not found!",
      });
    }

    /* ---------- Fetch store separately ---------- */
    let store = null;
    if (user.storeId) {
      store = await Store.findOne({ where: { id: user.storeId } });
    }

    /* ---------- Fetch package separately ---------- */
    let pkg = null;
    if (store?.packageId) {
      pkg = await Package.findOne({ where: { id: store.packageId } });
    }

    const storeWithPackage = store
      ? { ...store.toJSON(), package: pkg ? pkg.toJSON() : null }
      : null;

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully!",
      data: {
        user,
        store: storeWithPackage,
      },
    });
  } catch (error) {
    console.error("Error getting current store owner:", error);
    next(error);
  }
};







// =========================================================================
//! GET ALL STORE OWNERS (super admin)
// =========================================================================
const getAllStoreOwners = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
      storeStatus = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = { role: "STORE_OWNER" };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== "" && isActive !== undefined) {
      whereClause.isActive = isActive === "true" || isActive === true;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    // Enrich with store info
    const enriched = await Promise.all(
      users.map(async (user) => {
        const data = user.toJSON();
        let store = null;
        if (data.storeId) {
          store = await Store.findOne({ where: { id: data.storeId } });
        }

        // Optional store status filter
        if (storeStatus && store?.status !== storeStatus) return null;

        return {
          ...data,
          store: store
            ? {
                id: store.id,
                storeCode: store.storeCode,
                name: store.name,
                slug: store.slug,
                status: store.status,
                packageId: store.packageId,
                subscriptionStartAt: store.subscriptionStartAt,
                subscriptionEndAt: store.subscriptionEndAt,
                logo: store.logo,
              }
            : null,
        };
      })
    );

    // Filter out nulls (from storeStatus filter)
    const filtered = enriched.filter((u) => u !== null);

    return res.status(200).json({
      success: true,
      message: "Store owners retrieved successfully!",
      data: filtered,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting store owners:", error);
    next(error);
  }
};

// =========================================================================
//! GET STORE OWNER BY ID (super admin)
// =========================================================================
const getStoreOwnerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({
      where: { id, role: "STORE_OWNER" },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Store owner not found!",
      });
    }

    let store = null;
    if (user.storeId) {
      store = await Store.findOne({ where: { id: user.storeId } });
    }

    let pkg = null;
    if (store?.packageId) {
      pkg = await Package.findOne({ where: { id: store.packageId } });
    }

    return res.status(200).json({
      success: true,
      message: "Store owner retrieved successfully!",
      data: {
        user,
        store: store
          ? { ...store.toJSON(), package: pkg ? pkg.toJSON() : null }
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting store owner:", error);
    next(error);
  }
};

// =========================================================================
//! CREATE STORE OWNER (super admin — manual creation with a store)
// =========================================================================
const createStoreOwnerByAdmin = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      // Owner
      name,
      email,
      phone,
      password,

      // Store
      storeName,
      storeTagline,
      storeDescription,
      storePhone,
      storeEmail,
      storeAddress,
      storeDistrict,
      packageId,

      // Extra
      isActive = true,
      activateStore = false, // if true, store is ACTIVE immediately
    } = req.body;

    /* ---------- Validation ---------- */
    if (!name || !email || !phone || !password) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required!",
      });
    }
    if (!storeName) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Store name is required!",
      });
    }
    if (!packageId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Please select a package!",
      });
    }
    if (String(password).length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long!",
      });
    }

    /* ---------- Uniqueness ---------- */
    const emailExists = await User.findOne({
      where: { email: email.trim().toLowerCase() },
      transaction,
    });
    if (emailExists) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    const phoneExists = await User.findOne({
      where: { phone: phone.trim() },
      transaction,
    });
    if (phoneExists) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    /* ---------- Package ---------- */
    const pkg = await Package.findOne({
      where: { id: packageId },
      transaction,
    });
    if (!pkg) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    /* ---------- Create User ---------- */
    const newUser = await User.create(
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role: "STORE_OWNER",
        isActive: Boolean(isActive),
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    /* ---------- Create Store ---------- */
    const slug = await generateUniqueSlug(storeName, transaction);
    const storeCode = await generateStoreCode();

    const startAt = activateStore ? new Date() : null;
    const endAt = activateStore
      ? new Date(Date.now() + Number(pkg.durationDay || 30) * 24 * 60 * 60 * 1000)
      : null;

    const newStore = await Store.create(
      {
        storeCode,
        name: storeName.trim(),
        slug,
        tagline: storeTagline || null,
        description: storeDescription || null,
        email: storeEmail || email,
        phone: storePhone || phone,
        address: storeAddress || null,
        district: storeDistrict || null,
        country: "Bangladesh",

        ownerId: newUser.id,
        packageId: pkg.id,
        subscriptionStartAt: startAt,
        subscriptionEndAt: endAt,

        status: activateStore ? "ACTIVE" : "INACTIVE",
        primaryColor: "#1d6fff",
        secondaryColor: "#0b2545",
        createdBy: req.user?.id || null,
      },
      { transaction }
    );

    await newUser.update({ storeId: newStore.id }, { transaction });

    await transaction.commit();

    /* ---------- Reload ---------- */
    const safeUser = await User.findOne({
      where: { id: newUser.id },
      attributes: { exclude: ["password"] },
    });
    const safeStore = await Store.findOne({ where: { id: newStore.id } });

    return res.status(201).json({
      success: true,
      message: "Store owner created successfully!",
      data: {
        user: safeUser,
        store: { ...safeStore.toJSON(), package: pkg.toJSON() },
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("Error creating store owner by admin:", error);
    next(error);
  }
};

// =========================================================================
//! UPDATE STORE OWNER (super admin)
// =========================================================================
const updateStoreOwnerByAdmin = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      // User fields
      name,
      email,
      phone,
      isActive,

      // Store fields (optional — update if provided)
      storeName,
      storeTagline,
      storeDescription,
      storePhone,
      storeEmail,
      storeAddress,
      storeDistrict,
      packageId,
      storeStatus,
    } = req.body;

    const user = await User.findOne({
      where: { id, role: "STORE_OWNER" },
      transaction,
    });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Store owner not found!",
      });
    }

    /* ---------- Uniqueness (if email/phone changed) ---------- */
    if (email && email !== user.email) {
      const exists = await User.findOne({
        where: { email: email.trim().toLowerCase(), id: { [Op.ne]: id } },
        transaction,
      });
      if (exists) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "This email is already registered!",
        });
      }
    }
    if (phone && phone !== user.phone) {
      const exists = await User.findOne({
        where: { phone: phone.trim(), id: { [Op.ne]: id } },
        transaction,
      });
      if (exists) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered!",
        });
      }
    }

    /* ---------- Update user ---------- */
    const userUpdate = {};
    if (name !== undefined) userUpdate.name = name.trim();
    if (email !== undefined) userUpdate.email = email.trim().toLowerCase();
    if (phone !== undefined) userUpdate.phone = phone.trim();
    if (isActive !== undefined) userUpdate.isActive = Boolean(isActive);
    userUpdate.updatedBy = req.user?.id || null;

    if (Object.keys(userUpdate).length > 0) {
      await user.update(userUpdate, { transaction });
    }

    /* ---------- Update store (if exists and fields provided) ---------- */
    let store = null;
    if (user.storeId) {
      store = await Store.findOne({
        where: { id: user.storeId },
        transaction,
      });
    }

    if (store) {
      const storeUpdate = {};
      if (storeName !== undefined) storeUpdate.name = storeName.trim();
      if (storeTagline !== undefined) storeUpdate.tagline = storeTagline || null;
      if (storeDescription !== undefined)
        storeUpdate.description = storeDescription || null;
      if (storePhone !== undefined) storeUpdate.phone = storePhone || null;
      if (storeEmail !== undefined) storeUpdate.email = storeEmail || null;
      if (storeAddress !== undefined) storeUpdate.address = storeAddress || null;
      if (storeDistrict !== undefined)
        storeUpdate.district = storeDistrict || null;
      if (packageId !== undefined) storeUpdate.packageId = packageId;
      if (storeStatus !== undefined) storeUpdate.status = storeStatus;
      storeUpdate.updatedBy = req.user?.id || null;

      if (Object.keys(storeUpdate).length > 0) {
        await store.update(storeUpdate, { transaction });
      }
    }

    await transaction.commit();

    /* ---------- Reload ---------- */
    const safeUser = await User.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });
    const safeStore = safeUser.storeId
      ? await Store.findOne({ where: { id: safeUser.storeId } })
      : null;
    const pkg = safeStore?.packageId
      ? await Package.findOne({ where: { id: safeStore.packageId } })
      : null;

    return res.status(200).json({
      success: true,
      message: "Store owner updated successfully!",
      data: {
        user: safeUser,
        store: safeStore
          ? { ...safeStore.toJSON(), package: pkg ? pkg.toJSON() : null }
          : null,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("Error updating store owner:", error);
    next(error);
  }
};

// =========================================================================
//! TOGGLE STORE OWNER STATUS
// =========================================================================
const toggleStoreOwnerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findOne({ where: { id, role: "STORE_OWNER" } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Store owner not found!",
      });
    }

    const newStatus =
      isActive !== undefined ? Boolean(isActive) : !user.isActive;

    await user.update({
      isActive: newStatus,
      updatedBy: req.user?.id || null,
    });

    const safeUser = await User.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: `Store owner ${newStatus ? "activated" : "deactivated"} successfully!`,
      data: safeUser,
    });
  } catch (error) {
    console.error("Error toggling store owner status:", error);
    next(error);
  }
};

// =========================================================================
//! DELETE STORE OWNER (cascades to store)
// =========================================================================
const deleteStoreOwner = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const user = await User.findOne({
      where: { id, role: "STORE_OWNER" },
      transaction,
    });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Store owner not found!",
      });
    }

    /* ---------- Delete associated store first ---------- */
    if (user.storeId) {
      await Store.destroy({ where: { id: user.storeId }, transaction });
    }

    /* ---------- Delete user ---------- */
    await User.destroy({ where: { id }, transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Store owner deleted successfully!",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("Error deleting store owner:", error);
    next(error);
  }
};

// =========================================================================
//! STORE OWNER STATS (for stat cards)
// =========================================================================
const getStoreOwnerStats = async (req, res, next) => {
  try {
    const total = await User.count({ where: { role: "STORE_OWNER" } });
    const active = await User.count({
      where: { role: "STORE_OWNER", isActive: true },
    });
    const inactive = await User.count({
      where: { role: "STORE_OWNER", isActive: false },
    });

    // Count stores by status
    const totalStores = await Store.count();
    const activeStores = await Store.count({ where: { status: "ACTIVE" } });
    const inactiveStores = await Store.count({ where: { status: "INACTIVE" } });

    return res.status(200).json({
      success: true,
      message: "Stats retrieved successfully!",
      data: {
        total,
        active,
        inactive,
        totalStores,
        activeStores,
        inactiveStores,
      },
    });
  } catch (error) {
    console.error("Error getting store owner stats:", error);
    next(error);
  }
};










module.exports = {
  registerStoreOwner,
  loginStoreOwner,
  getCurrentStoreOwner,






  getAllStoreOwners,
  getStoreOwnerById,
  createStoreOwnerByAdmin,
  updateStoreOwnerByAdmin,
  toggleStoreOwnerStatus,
  deleteStoreOwner,
  getStoreOwnerStats,
};