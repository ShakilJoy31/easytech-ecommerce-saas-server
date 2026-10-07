// controller/product.controller.js
const { Op } = require("sequelize");
const Product = require("../../models/store-owner/product.model");
const Category = require("../../models/store-owner/category.model");
const Store = require("../../models/store.model");
const Package = require("../../models/package.model");

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
    .slice(0, 80);
};

//! Generate a human-readable product code
const generateProductCode = async () => {
  const year = new Date().getFullYear();
  const count = await Product.count();
  return `PRD-${year}-${String(count + 1).padStart(5, "0")}`;
};

//! Normalize array fields (JSON column may return string on some setups)
const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

//! Transform product for response
const transformProduct = (product, category = null) => {
  const data = product.toJSON ? product.toJSON() : product;
  return {
    ...data,
    images: normalizeArray(data.images),
    tags: normalizeArray(data.tags),
    category: category
      ? {
          id: category.id,
          title: category.title,
          slug: category.slug,
        }
      : null,
  };
};

/* =========================================================================
   CREATE PRODUCT (store owner)
========================================================================= */
const createProduct = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;

    const {
      title,
      description,
      shortDescription,
      price,
      compareAtPrice,
      costPrice,
      currency = "BDT",
      images,
      thumbnail,
      stock = 0,
      sku,
      trackStock = true,
      categoryId,
      tags,
      isFeatured = false,
      isActive = true,
      displayOrder = 0,
    } = req.body;

    /* ---------- Validation ---------- */
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product title is required!",
      });
    }

    if (price === undefined || price === null || price === "") {
      return res.status(400).json({
        success: false,
        message: "Price is required!",
      });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a valid positive number!",
      });
    }

    /* ---------- Store + package limits ---------- */
    const store = await Store.findOne({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found!",
      });
    }

    if (store.packageId) {
      const pkg = await Package.findOne({ where: { id: store.packageId } });
      if (pkg && pkg.maxProducts !== null) {
        const currentCount = await Product.count({ where: { storeId } });
        if (currentCount >= pkg.maxProducts) {
          return res.status(403).json({
            success: false,
            message: `Your package allows only ${pkg.maxProducts} products. Upgrade to add more.`,
          });
        }
      }
    }

    /* ---------- Category validation (must belong to this store) ---------- */
    let validCategoryId = null;
    if (categoryId) {
      const cat = await Category.findOne({
        where: { id: categoryId, storeId },
      });
      if (!cat) {
        return res.status(404).json({
          success: false,
          message: "Category not found in your store!",
        });
      }
      validCategoryId = cat.id;
    }

    /* ---------- Unique slug within store ---------- */
    let slug = generateSlug(title);
    if (!slug) slug = "product";

    let slugExists = await Product.findOne({ where: { storeId, slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(title)}-${counter}`;
      slugExists = await Product.findOne({ where: { storeId, slug } });
      counter++;
    }

    /* ---------- Product code ---------- */
    const productCode = await generateProductCode();

    /* ---------- Normalize arrays ---------- */
    const imagesArr = normalizeArray(images);
    const tagsArr = normalizeArray(tags);

    /* ---------- Create ---------- */
    const product = await Product.create({
      productCode,
      title: title.trim(),
      slug,
      description: description || null,
      shortDescription: shortDescription || null,

      price: priceNum,
      compareAtPrice:
        compareAtPrice !== undefined && compareAtPrice !== "" && compareAtPrice !== null
          ? parseFloat(compareAtPrice)
          : null,
      costPrice:
        costPrice !== undefined && costPrice !== "" && costPrice !== null
          ? parseFloat(costPrice)
          : null,
      currency,

      images: imagesArr,
      thumbnail: thumbnail || imagesArr[0] || null,

      stock: parseInt(stock, 10) || 0,
      sku: sku || null,
      trackStock: Boolean(trackStock),

      categoryId: validCategoryId,
      storeId,

      tags: tagsArr,

      isFeatured: Boolean(isFeatured),
      isActive: Boolean(isActive),
      displayOrder: parseInt(displayOrder, 10) || 0,

      createdBy: userId,
    });

    /* ---------- Fetch category for response ---------- */
    let cat = null;
    if (product.categoryId) {
      cat = await Category.findOne({ where: { id: product.categoryId } });
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully!",
      data: transformProduct(product, cat),
    });
  } catch (error) {
    console.error("Error creating product:", error);
    next(error);
  }
};

/* =========================================================================
   GET ALL PRODUCTS (store owner — scoped)
========================================================================= */
const getAllProducts = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const {
      page = 1,
      limit = 10,
      search = "",
      categoryId = "",
      isActive = "",
      isFeatured = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = { storeId };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { productCode: { [Op.like]: `%${search}%` } },
      ];
    }

    if (categoryId) whereClause.categoryId = categoryId;
    if (isActive !== "" && isActive !== undefined)
      whereClause.isActive = isActive === "true" || isActive === true;
    if (isFeatured !== "" && isFeatured !== undefined)
      whereClause.isFeatured = isFeatured === "true" || isFeatured === true;

    const validSortFields = [
      "createdAt",
      "updatedAt",
      "title",
      "price",
      "stock",
      "totalSold",
      "displayOrder",
    ];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [
        [safeSortBy, safeSortOrder],
        ["id", "DESC"],
      ],
    });

    /* ---------- Attach categories separately ---------- */
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))];
    const categories = categoryIds.length
      ? await Category.findAll({ where: { id: categoryIds } })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const enriched = products.map((p) =>
      transformProduct(p, p.categoryId ? catMap.get(p.categoryId) : null)
    );

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting products:", error);
    next(error);
  }
};

/* =========================================================================
   GET PRODUCT BY ID (store owner — scoped)
========================================================================= */
const getProductById = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const product = await Product.findOne({ where: { id, storeId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    let cat = null;
    if (product.categoryId) {
      cat = await Category.findOne({ where: { id: product.categoryId } });
    }

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully!",
      data: transformProduct(product, cat),
    });
  } catch (error) {
    console.error("Error getting product:", error);
    next(error);
  }
};

/* =========================================================================
   UPDATE PRODUCT (store owner — scoped)
========================================================================= */
const updateProduct = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { id } = req.params;
    const updateData = { ...req.body };

    const product = await Product.findOne({ where: { id, storeId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    /* ---------- Handle title change → regen slug ---------- */
    if (updateData.title && updateData.title.trim() !== product.title) {
      const trimmed = updateData.title.trim();
      if (!trimmed) {
        return res.status(400).json({
          success: false,
          message: "Title cannot be empty!",
        });
      }

      let slug = generateSlug(trimmed);
      if (!slug) slug = "product";

      let slugExists = await Product.findOne({
        where: { storeId, slug, id: { [Op.ne]: id } },
      });
      let counter = 1;
      while (slugExists) {
        slug = `${generateSlug(trimmed)}-${counter}`;
        slugExists = await Product.findOne({
          where: { storeId, slug, id: { [Op.ne]: id } },
        });
        counter++;
      }

      updateData.title = trimmed;
      updateData.slug = slug;
    }

    /* ---------- Category validation ---------- */
    if (updateData.categoryId !== undefined) {
      if (updateData.categoryId === "" || updateData.categoryId === null) {
        updateData.categoryId = null;
      } else {
        const cat = await Category.findOne({
          where: { id: updateData.categoryId, storeId },
        });
        if (!cat) {
          return res.status(404).json({
            success: false,
            message: "Category not found in your store!",
          });
        }
      }
    }

    /* ---------- Parse numeric fields ---------- */
    if (updateData.price !== undefined) {
      updateData.price = parseFloat(updateData.price);
      if (isNaN(updateData.price) || updateData.price < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price!",
        });
      }
    }
    if (updateData.compareAtPrice !== undefined) {
      updateData.compareAtPrice =
        updateData.compareAtPrice === "" || updateData.compareAtPrice === null
          ? null
          : parseFloat(updateData.compareAtPrice);
    }
    if (updateData.costPrice !== undefined) {
      updateData.costPrice =
        updateData.costPrice === "" || updateData.costPrice === null
          ? null
          : parseFloat(updateData.costPrice);
    }
    if (updateData.stock !== undefined) {
      updateData.stock = parseInt(updateData.stock, 10) || 0;
    }
    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder, 10) || 0;
    }

    /* ---------- Booleans ---------- */
    if (updateData.isActive !== undefined)
      updateData.isActive = Boolean(updateData.isActive);
    if (updateData.isFeatured !== undefined)
      updateData.isFeatured = Boolean(updateData.isFeatured);
    if (updateData.trackStock !== undefined)
      updateData.trackStock = Boolean(updateData.trackStock);

    /* ---------- Arrays ---------- */
    if (updateData.images !== undefined)
      updateData.images = normalizeArray(updateData.images);
    if (updateData.tags !== undefined)
      updateData.tags = normalizeArray(updateData.tags);

    updateData.updatedBy = userId;

    await product.update(updateData);

    const updated = await Product.findOne({ where: { id, storeId } });
    let cat = null;
    if (updated.categoryId) {
      cat = await Category.findOne({ where: { id: updated.categoryId } });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully!",
      data: transformProduct(updated, cat),
    });
  } catch (error) {
    console.error("Error updating product:", error);
    next(error);
  }
};

/* =========================================================================
   TOGGLE PRODUCT STATUS
========================================================================= */
const toggleProductStatus = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { id } = req.params;
    const { isActive } = req.body;

    const product = await Product.findOne({ where: { id, storeId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    const newStatus =
      isActive !== undefined ? Boolean(isActive) : !product.isActive;

    await product.update({ isActive: newStatus, updatedBy: userId });

    const updated = await Product.findOne({ where: { id, storeId } });

    return res.status(200).json({
      success: true,
      message: `Product ${newStatus ? "activated" : "deactivated"} successfully!`,
      data: transformProduct(updated),
    });
  } catch (error) {
    console.error("Error toggling product status:", error);
    next(error);
  }
};

/* =========================================================================
   TOGGLE FEATURED
========================================================================= */
const toggleProductFeatured = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { id } = req.params;

    const product = await Product.findOne({ where: { id, storeId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    await product.update({
      isFeatured: !product.isFeatured,
      updatedBy: userId,
    });

    const updated = await Product.findOne({ where: { id, storeId } });

    return res.status(200).json({
      success: true,
      message: `Product ${updated.isFeatured ? "featured" : "unfeatured"}!`,
      data: transformProduct(updated),
    });
  } catch (error) {
    console.error("Error toggling product featured:", error);
    next(error);
  }
};

/* =========================================================================
   DELETE PRODUCT
========================================================================= */
const deleteProduct = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const product = await Product.findOne({ where: { id, storeId } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    await product.destroy();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    next(error);
  }
};

/* =========================================================================
   PRODUCT STATS
========================================================================= */
const getProductStats = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;

    const total = await Product.count({ where: { storeId } });
    const active = await Product.count({ where: { storeId, isActive: true } });
    const inactive = await Product.count({
      where: { storeId, isActive: false },
    });
    const featured = await Product.count({
      where: { storeId, isFeatured: true },
    });
    const outOfStock = await Product.count({
      where: { storeId, stock: 0, trackStock: true },
    });

    return res.status(200).json({
      success: true,
      message: "Product stats retrieved successfully!",
      data: { total, active, inactive, featured, outOfStock },
    });
  } catch (error) {
    console.error("Error getting product stats:", error);
    next(error);
  }
};









// =========================================================================
//! GET PUBLIC PRODUCTS (across all active stores)
// =========================================================================
const getPublicProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = "",
      categorySlug = "",
      storeSlug = "",
      isFeatured = "",
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    /* ---------- Find active stores ---------- */
    let storeFilter = {};
    if (storeSlug) {
      storeFilter = { slug: storeSlug, status: "ACTIVE" };
    } else {
      storeFilter = { status: "ACTIVE" };
    }
    const activeStores = await Store.findAll({
      where: storeFilter,
      attributes: ["id"],
    });
    const activeStoreIds = activeStores.map((s) => s.id);

    if (activeStoreIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active stores found!",
        data: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: pageNumber,
          itemsPerPage: limitNumber,
        },
      });
    }

    /* ---------- Base where clause ---------- */
    const whereClause = {
      storeId: { [Op.in]: activeStoreIds },
      isActive: true,
    };

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { shortDescription: { [Op.like]: `%${search}%` } },
        { tags: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isFeatured !== "" && isFeatured !== undefined) {
      whereClause.isFeatured = isFeatured === "true" || isFeatured === true;
    }

    /* ---------- Category filter (by slug) ---------- */
    if (categorySlug) {
      const cat = await Category.findOne({ where: { slug: categorySlug } });
      if (!cat) {
        return res.status(404).json({
          success: false,
          message: "Category not found!",
        });
      }
      whereClause.categoryId = cat.id;
    }

    /* ---------- Sort ---------- */
    const validSortFields = ["createdAt", "price", "totalSold", "title"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [
        [safeSortBy, safeSortOrder],
        ["id", "DESC"],
      ],
    });

    /* ---------- Enrich with category + store ---------- */
    const categoryIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))];
    const storeIds = [...new Set(products.map((p) => p.storeId).filter(Boolean))];

    const categories = categoryIds.length
      ? await Category.findAll({ where: { id: categoryIds } })
      : [];
    const stores = storeIds.length
      ? await Store.findAll({ where: { id: storeIds } })
      : [];

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    const enriched = products.map((p) => {
      const data = p.toJSON();
      const cat = p.categoryId ? catMap.get(p.categoryId) : null;
      const store = storeMap.get(p.storeId);
      return {
        ...data,
        images: normalizeArray(data.images),
        tags: normalizeArray(data.tags),
        category: cat
          ? { id: cat.id, title: cat.title, slug: cat.slug }
          : null,
        store: store
          ? {
              id: store.id,
              name: store.name,
              slug: store.slug,
              logo: store.logo,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Public products retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting public products:", error);
    next(error);
  }
};


// =========================================================================
//! GET PUBLIC PRODUCT BY ID (no auth — for product detail page)
// =========================================================================
const getPublicProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      where: { id, isActive: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found!",
      });
    }

    // Only show products from ACTIVE stores
    const store = await Store.findOne({ where: { id: product.storeId } });
    if (!store || store.status !== "ACTIVE") {
      return res.status(404).json({
        success: false,
        message: "Product not available!",
      });
    }

    // Attach category
    let cat = null;
    if (product.categoryId) {
      cat = await Category.findOne({ where: { id: product.categoryId } });
    }

    // Increment views (fire-and-forget)
    Product.update(
      { totalViews: (product.totalViews || 0) + 1 },
      { where: { id: product.id } }
    ).catch(() => {});

    const data = product.toJSON();

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully!",
      data: {
        ...data,
        images: normalizeArray(data.images),
        tags: normalizeArray(data.tags),
        category: cat
          ? { id: cat.id, title: cat.title, slug: cat.slug }
          : null,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          logo: store.logo,
          tagline: store.tagline,
        },
      },
    });
  } catch (error) {
    console.error("Error getting public product:", error);
    next(error);
  }
};





module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  toggleProductStatus,
  toggleProductFeatured,
  deleteProduct,
  getProductStats,
  getPublicProducts,
  getPublicProductById
};