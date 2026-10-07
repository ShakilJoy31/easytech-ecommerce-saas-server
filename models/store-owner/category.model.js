// models/category.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../../database/connection");

const Category = sequelize.define(
  "category-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
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
    image: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ TENANT ============
    storeId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to store-collections
    },
    userId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to user-collections (STORE_OWNER who created it)
    },

    // ============ DISPLAY ============
    displayOrder: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: "category-collections",
    timestamps: true,
    indexes: [
      { fields: ["storeId"] },
      { fields: ["storeId", "slug"], unique: true },
      { fields: ["storeId", "title"], unique: true },
      { fields: ["userId"] },
      { fields: ["isActive"] },
      { fields: ["displayOrder"] },
    ],
  },
);

module.exports = Category;