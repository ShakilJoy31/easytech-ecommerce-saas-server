// controller/package.controller.js
const { Op } = require("sequelize");
const Package = require("../models/package.model");
const Store = require("../models/store.model");
const sequelize = require("../database/connection");

//! Helper — transform package response
const transformPackageResponse = (pkg) => {
  const data = pkg.toJSON ? pkg.toJSON() : pkg;
  return {
    ...data,
    // Human-readable duration
    durationLabel:
      data.durationDay === 30
        ? "Monthly"
        : data.durationDay === 365
        ? "Yearly"
        : data.durationDay === 7
        ? "Weekly"
        : `${data.durationDay} days`,
    // Human-readable limits
    maxProductsLabel:
      data.maxProducts === null ? "Unlimited" : String(data.maxProducts),
    maxCategoriesLabel:
      data.maxCategories === null ? "Unlimited" : String(data.maxCategories),
    maxOrdersPerMonthLabel:
      data.maxOrdersPerMonth === null
        ? "Unlimited"
        : String(data.maxOrdersPerMonth),
  };
};

//! Helper — auto-generate slug from name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

// =========================================================================
//! CREATE PACKAGE
// =========================================================================
const createPackage = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      currency = "BDT",
      durationDay = 30,
      maxProducts,
      maxCategories,
      maxOrdersPerMonth,
      features,
      displayOrder = 0,
      isPopular = false,
      isActive = true,
    } = req.body;

    // Validate required
    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "Package name and price are required!",
      });
    }

    // Check name uniqueness
    const nameExists = await Package.findOne({ where: { name } });
    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: "A package with this name already exists!",
      });
    }

    // Generate unique slug
    let slug = generateSlug(name);
    let slugExists = await Package.findOne({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(name)}-${counter}`;
      slugExists = await Package.findOne({ where: { slug } });
      counter++;
    }

    // Parse features — accept array OR comma-separated string
    let parsedFeatures = [];
    if (Array.isArray(features)) {
      parsedFeatures = features.filter((f) => f && String(f).trim());
    } else if (typeof features === "string" && features.trim()) {
      parsedFeatures = features
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    }

    const newPackage = await Package.create({
      name: name.trim(),
      slug,
      description: description || null,
      price: parseFloat(price),
      currency,
      durationDay: parseInt(durationDay, 10),
      maxProducts:
        maxProducts === "" || maxProducts === null || maxProducts === undefined
          ? null
          : parseInt(maxProducts, 10),
      maxCategories:
        maxCategories === "" || maxCategories === null || maxCategories === undefined
          ? null
          : parseInt(maxCategories, 10),
      maxOrdersPerMonth:
        maxOrdersPerMonth === "" || maxOrdersPerMonth === null || maxOrdersPerMonth === undefined
          ? null
          : parseInt(maxOrdersPerMonth, 10),
      features: parsedFeatures,
      displayOrder: parseInt(displayOrder, 10) || 0,
      isPopular: Boolean(isPopular),
      isActive: Boolean(isActive),
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Package created successfully!",
      data: transformPackageResponse(newPackage),
    });
  } catch (error) {
    console.error("Error creating package:", error);
    next(error);
  }
};

// =========================================================================
//! GET ALL PACKAGES (with pagination, search, filters)
// =========================================================================
const getAllPackages = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
      isPopular = "",
      sortBy = "displayOrder",
      sortOrder = "ASC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Search
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filters
    if (isActive !== "" && isActive !== undefined) {
      whereClause.isActive = isActive === "true" || isActive === true;
    }
    if (isPopular !== "" && isPopular !== undefined) {
      whereClause.isPopular = isPopular === "true" || isPopular === true;
    }

    // Sorting
    const validSortFields = [
      "displayOrder",
      "name",
      "price",
      "createdAt",
      "durationDay",
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "displayOrder";
    const safeSortOrder = sortOrder.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const { count, rows: packages } = await Package.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [
        [safeSortBy, safeSortOrder],
        ["createdAt", "DESC"],
      ],
    });

    const transformedPackages = packages.map(transformPackageResponse);
    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Packages retrieved successfully!",
      data: transformedPackages,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting packages:", error);
    next(error);
  }
};

// =========================================================================
//! GET PUBLIC PACKAGES (for landing page — active only)
// =========================================================================
const getPublicPackages = async (req, res, next) => {
  try {
    const packages = await Package.findAll({
      where: { isActive: true },
      order: [
        ["displayOrder", "ASC"],
        ["price", "ASC"],
      ],
    });

    const transformedPackages = packages.map(transformPackageResponse);

    return res.status(200).json({
      success: true,
      message: "Public packages retrieved successfully!",
      data: transformedPackages,
    });
  } catch (error) {
    console.error("Error getting public packages:", error);
    next(error);
  }
};

// =========================================================================
//! GET PACKAGE BY ID
// =========================================================================
const getPackageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pkg = await Package.findOne({ where: { id } });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Package retrieved successfully!",
      data: transformPackageResponse(pkg),
    });
  } catch (error) {
    console.error("Error getting package by ID:", error);
    next(error);
  }
};

// =========================================================================
//! GET PACKAGE BY SLUG (public)
// =========================================================================
const getPackageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const pkg = await Package.findOne({ where: { slug } });

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Package retrieved successfully!",
      data: transformPackageResponse(pkg),
    });
  } catch (error) {
    console.error("Error getting package by slug:", error);
    next(error);
  }
};

// =========================================================================
//! UPDATE PACKAGE
// =========================================================================
const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existingPackage = await Package.findOne({ where: { id } });
    if (!existingPackage) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    // Name uniqueness check (if changed)
    if (updateData.name && updateData.name !== existingPackage.name) {
      const nameExists = await Package.findOne({
        where: { name: updateData.name, id: { [Op.ne]: id } },
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "A package with this name already exists!",
        });
      }

      // Regenerate slug if name changed
      let slug = generateSlug(updateData.name);
      let slugExists = await Package.findOne({
        where: { slug, id: { [Op.ne]: id } },
      });
      let counter = 1;
      while (slugExists) {
        slug = `${generateSlug(updateData.name)}-${counter}`;
        slugExists = await Package.findOne({
          where: { slug, id: { [Op.ne]: id } },
        });
        counter++;
      }
      updateData.slug = slug;
    }

    // Parse numeric fields
    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
    }
    if (updateData.durationDay !== undefined) {
      updateData.durationDay = parseInt(updateData.durationDay, 10);
    }
    if (updateData.maxProducts !== undefined) {
      updateData.maxProducts =
        updateData.maxProducts === "" || updateData.maxProducts === null
          ? null
          : parseInt(updateData.maxProducts, 10);
    }
    if (updateData.maxCategories !== undefined) {
      updateData.maxCategories =
        updateData.maxCategories === "" || updateData.maxCategories === null
          ? null
          : parseInt(updateData.maxCategories, 10);
    }
    if (updateData.maxOrdersPerMonth !== undefined) {
      updateData.maxOrdersPerMonth =
        updateData.maxOrdersPerMonth === "" || updateData.maxOrdersPerMonth === null
          ? null
          : parseInt(updateData.maxOrdersPerMonth, 10);
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder, 10) || 0;
    }

    // Parse booleans
    if (updateData.isPopular !== undefined) {
      updateData.isPopular = Boolean(updateData.isPopular);
    }
    if (updateData.isActive !== undefined) {
      updateData.isActive = Boolean(updateData.isActive);
    }

    // Parse features
    if (updateData.features !== undefined) {
      if (Array.isArray(updateData.features)) {
        updateData.features = updateData.features.filter(
          (f) => f && String(f).trim()
        );
      } else if (typeof updateData.features === "string") {
        updateData.features = updateData.features
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
      } else {
        updateData.features = [];
      }
    }

    updateData.updatedBy = req.user?.id || null;

    await Package.update(updateData, { where: { id } });

    const updatedPackage = await Package.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Package updated successfully!",
      data: transformPackageResponse(updatedPackage),
    });
  } catch (error) {
    console.error("Error updating package:", error);
    next(error);
  }
};

// =========================================================================
//! DELETE PACKAGE
// =========================================================================
const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const pkg = await Package.findOne({ where: { id } });
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    // Prevent deleting if stores are using this package
    const storeCount = await Store.count({ where: { packageId: id } });
    if (storeCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete. ${storeCount} store(s) are using this package. Deactivate it instead.`,
      });
    }

    await Package.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Package deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting package:", error);
    next(error);
  }
};

// =========================================================================
//! TOGGLE PACKAGE STATUS (Active/Inactive)
// =========================================================================
const togglePackageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const pkg = await Package.findOne({ where: { id } });
    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found!",
      });
    }

    const newStatus =
      isActive !== undefined ? Boolean(isActive) : !pkg.isActive;

    await Package.update(
      { isActive: newStatus, updatedBy: req.user?.id || null },
      { where: { id } }
    );

    const updatedPackage = await Package.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: `Package ${newStatus ? "activated" : "deactivated"} successfully!`,
      data: transformPackageResponse(updatedPackage),
    });
  } catch (error) {
    console.error("Error toggling package status:", error);
    next(error);
  }
};

// =========================================================================
//! REORDER PACKAGES (bulk update displayOrder)
// =========================================================================
const reorderPackages = async (req, res, next) => {
  try {
    const { items } = req.body; // [{ id, displayOrder }, ...]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items array is required!",
      });
    }

    const transaction = await sequelize.transaction();

    try {
      for (const item of items) {
        await Package.update(
          { displayOrder: parseInt(item.displayOrder, 10) || 0 },
          { where: { id: item.id }, transaction }
        );
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    return res.status(200).json({
      success: true,
      message: "Packages reordered successfully!",
    });
  } catch (error) {
    console.error("Error reordering packages:", error);
    next(error);
  }
};

// =========================================================================
//! GET PACKAGE STATS
// =========================================================================
const getPackageStats = async (req, res, next) => {
  try {
    const total = await Package.count();
    const active = await Package.count({ where: { isActive: true } });
    const inactive = await Package.count({ where: { isActive: false } });
    const popular = await Package.count({ where: { isPopular: true } });

    // Revenue potential (sum of active package prices)
    const revenuePotential = await Package.sum("price", {
      where: { isActive: true },
    });

    // Price range
    const minPrice = await Package.min("price", { where: { isActive: true } });
    const maxPrice = await Package.max("price", { where: { isActive: true } });

    return res.status(200).json({
      success: true,
      message: "Package statistics retrieved successfully!",
      data: {
        total,
        active,
        inactive,
        popular,
        revenuePotential: revenuePotential || 0,
        minPrice: minPrice || 0,
        maxPrice: maxPrice || 0,
      },
    });
  } catch (error) {
    console.error("Error getting package stats:", error);
    next(error);
  }
};

module.exports = {
  createPackage,
  getAllPackages,
  getPublicPackages,
  getPackageById,
  getPackageBySlug,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  reorderPackages,
  getPackageStats,
};