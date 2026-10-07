// controller/category.controller.js
const { Op } = require("sequelize");
const Package = require("../../models/package.model");
const Store = require("../../models/store.model");
const Category = require("../../models/store-owner/category.model");
const Product = require("../../models/store-owner/product.model");


/* =========================================================================
   Helpers
========================================================================= */
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
};

const transformCategory = (category) => {
  const data = category.toJSON ? category.toJSON() : category;
  return data;
};

/* =========================================================================
   CREATE CATEGORY (store owner)
========================================================================= */
const createCategory = async (req, res, next) => {
  try {
    const { title, description, image, displayOrder = 0, isActive = true } =
      req.body;

    const storeId = req.user.storeId;
    const userId = req.user.id;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category title is required!",
      });
    }

    // Check package limits
    const store = await Store.findOne({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    if (store.packageId) {
      const pkg = await Package.findOne({ where: { id: store.packageId } });
      if (pkg && pkg.maxCategories !== null) {
        const currentCount = await Category.count({ where: { storeId } });
        if (currentCount >= pkg.maxCategories) {
          return res.status(403).json({
            success: false,
            message: `Your package allows only ${pkg.maxCategories} categories. Please upgrade to add more.`,
          });
        }
      }
    }

    // Check duplicate title in same store
    const titleExists = await Category.findOne({
      where: { storeId, title: title.trim() },
    });
    if (titleExists) {
      return res.status(409).json({
        success: false,
        message: "A category with this title already exists in your store!",
      });
    }

    // Generate unique slug within this store
    let slug = generateSlug(title);
    if (!slug) slug = "category";

    let slugExists = await Category.findOne({ where: { storeId, slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(title)}-${counter}`;
      slugExists = await Category.findOne({ where: { storeId, slug } });
      counter++;
    }

    const category = await Category.create({
      title: title.trim(),
      slug,
      description: description || null,
      image: image || null,
      storeId,
      userId,
      displayOrder: parseInt(displayOrder, 10) || 0,
      isActive: Boolean(isActive),
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully!",
      data: transformCategory(category),
    });
  } catch (error) {
    console.error("Error creating category:", error);
    next(error);
  }
};

/* =========================================================================
   GET ALL CATEGORIES (store owner — scoped)
========================================================================= */
const getAllCategories = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = { storeId };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== "" && isActive !== undefined) {
      whereClause.isActive = isActive === "true" || isActive === true;
    }

    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // Attach product count per category
    const enriched = await Promise.all(
      categories.map(async (cat) => {
        const data = cat.toJSON();
        const productCount = await Product.count({
          where: { categoryId: cat.id, storeId },
        });
        return { ...data, productCount };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    next(error);
  }
};

/* =========================================================================
   GET CATEGORY BY ID (store owner — scoped)
========================================================================= */
const getCategoryById = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const category = await Category.findOne({ where: { id, storeId } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found!",
      });
    }

    const productCount = await Product.count({
      where: { categoryId: id, storeId },
    });

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully!",
      data: { ...transformCategory(category), productCount },
    });
  } catch (error) {
    console.error("Error getting category:", error);
    next(error);
  }
};

/* =========================================================================
   UPDATE CATEGORY (store owner — scoped)
========================================================================= */
const updateCategory = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, image, displayOrder, isActive } = req.body;

    const category = await Category.findOne({ where: { id, storeId } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found!",
      });
    }

    const updateData = {};

    // Handle title change → also regenerate slug + uniqueness check
    if (title !== undefined && title.trim() !== category.title) {
      const trimmed = title.trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          message: "Category title cannot be empty!",
        });
      }

      const titleExists = await Category.findOne({
        where: { storeId, title: trimmed, id: { [Op.ne]: id } },
      });
      if (titleExists) {
        return res.status(409).json({
          success: false,
          message: "A category with this title already exists!",
        });
      }

      let slug = generateSlug(trimmed);
      let slugExists = await Category.findOne({
        where: { storeId, slug, id: { [Op.ne]: id } },
      });
      let counter = 1;
      while (slugExists) {
        slug = `${generateSlug(trimmed)}-${counter}`;
        slugExists = await Category.findOne({
          where: { storeId, slug, id: { [Op.ne]: id } },
        });
        counter++;
      }

      updateData.title = trimmed;
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description || null;
    if (image !== undefined) updateData.image = image || null;
    if (displayOrder !== undefined)
      updateData.displayOrder = parseInt(displayOrder, 10) || 0;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    updateData.updatedBy = userId;

    await category.update(updateData);

    const updated = await Category.findOne({ where: { id, storeId } });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully!",
      data: transformCategory(updated),
    });
  } catch (error) {
    console.error("Error updating category:", error);
    next(error);
  }
};

/* =========================================================================
   DELETE CATEGORY (store owner — scoped)
========================================================================= */
const deleteCategory = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const category = await Category.findOne({ where: { id, storeId } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found!",
      });
    }

    // Prevent deleting if products use it
    const productCount = await Product.count({
      where: { categoryId: id, storeId },
    });
    if (productCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete. ${productCount} product(s) use this category. Move or delete them first.`,
      });
    }

    await category.destroy();

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    next(error);
  }
};

/* =========================================================================
   TOGGLE CATEGORY STATUS (store owner — scoped)
========================================================================= */
const toggleCategoryStatus = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { id } = req.params;
    const { isActive } = req.body;

    const category = await Category.findOne({ where: { id, storeId } });
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found!",
      });
    }

    const newStatus =
      isActive !== undefined ? Boolean(isActive) : !category.isActive;

    await category.update({
      isActive: newStatus,
      updatedBy: userId,
    });

    const updated = await Category.findOne({ where: { id, storeId } });

    return res.status(200).json({
      success: true,
      message: `Category ${newStatus ? "activated" : "deactivated"} successfully!`,
      data: transformCategory(updated),
    });
  } catch (error) {
    console.error("Error toggling category status:", error);
    next(error);
  }
};

/* =========================================================================
   CATEGORY STATS (store owner)
========================================================================= */
const getCategoryStats = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;

    const total = await Category.count({ where: { storeId } });
    const active = await Category.count({ where: { storeId, isActive: true } });
    const inactive = await Category.count({
      where: { storeId, isActive: false },
    });

    return res.status(200).json({
      success: true,
      message: "Category stats retrieved successfully!",
      data: { total, active, inactive },
    });
  } catch (error) {
    console.error("Error getting category stats:", error);
    next(error);
  }
};

/* =========================================================================
   GET SIMPLE LIST (for product form dropdown)
   Returns only active categories, no pagination.
========================================================================= */
const getCategoryOptions = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;

    const categories = await Category.findAll({
      where: { storeId, isActive: true },
      attributes: ["id", "title", "slug"],
      order: [
        ["displayOrder", "ASC"],
        ["title", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Category options retrieved successfully!",
      data: categories,
    });
  } catch (error) {
    console.error("Error getting category options:", error);
    next(error);
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  getCategoryStats,
  getCategoryOptions,
};