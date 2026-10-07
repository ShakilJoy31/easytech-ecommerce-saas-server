// models/product.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Product = sequelize.define(
  "product-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
    productCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // Human-readable ID e.g. PRD-2026-0001
    },
    title: {
      type: dt.STRING,
      allowNull: false,
    },
    slug: {
      type: dt.STRING,
      allowNull: false,
      // Unique per store, not globally
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    shortDescription: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ PRICING ============
    price: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    compareAtPrice: {
      type: dt.FLOAT,
      allowNull: true,
      // Original price for "discount" display (strikethrough)
    },
    costPrice: {
      type: dt.FLOAT,
      allowNull: true,
      // Internal cost for profit reporting
    },
    currency: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "BDT",
    },

    // ============ IMAGES ============
    images: {
      type: dt.JSON,
      allowNull: true,
      defaultValue: [],
      // ["url1", "url2", "url3"]
    },
    thumbnail: {
      type: dt.STRING,
      allowNull: true,
      // Fast-loading primary image
    },

    // ============ STOCK ============
    stock: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sku: {
      type: dt.STRING,
      allowNull: true,
    },
    trackStock: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // ============ LINKS ============
    categoryId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to category-collections
    },
    storeId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to store-collections (TENANT KEY)
    },

    // ============ TAGS ============
    tags: {
      type: dt.JSON,
      allowNull: true,
      defaultValue: [],
      // ["new", "sale", "featured"]
    },

    // ============ DISPLAY ============
    isFeatured: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    displayOrder: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // ============ STATS ============
    totalSold: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalViews: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // ============ META ============
    createdBy: {
      type: dt.INTEGER,
      allowNull: true,
    },
    updatedBy: {
      type: dt.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "product-collections",
    timestamps: true,
    indexes: [
      { fields: ["productCode"], unique: true },
      { fields: ["storeId"] },
      { fields: ["storeId", "slug"], unique: true },
      { fields: ["categoryId"] },
      { fields: ["isActive"] },
      { fields: ["isFeatured"] },
      { fields: ["price"] },
      { fields: ["totalSold"] },
    ],
  },
);

module.exports = Product;