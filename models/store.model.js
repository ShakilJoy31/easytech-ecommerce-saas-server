// models/store.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const Store = sequelize.define(
  "store-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
    storeCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // Human-readable ID e.g. STR-2026-0001
    },
    name: {
      type: dt.STRING,
      allowNull: false,
    },
    slug: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // Used in URLs: /store/<slug>
    },
    tagline: {
      type: dt.STRING,
      allowNull: true,
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },
    logo: {
      type: dt.STRING,
      allowNull: true,
      // Cloudinary / S3 URL
    },
    banner: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ CONTACT ============
    email: {
      type: dt.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: dt.STRING,
      allowNull: true,
    },
    address: {
      type: dt.TEXT,
      allowNull: true,
    },
    district: {
      type: dt.STRING,
      allowNull: true,
    },
    country: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Bangladesh",
    },

    // ============ OWNERSHIP ============
    ownerId: {
      type: dt.INTEGER,
      allowNull: false,
      unique: true,
      // FK to user-collections (role = STORE_OWNER)
    },

    // ============ SUBSCRIPTION ============
    packageId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to package-collections
    },
    subscriptionStartAt: {
      type: dt.DATE,
      allowNull: true,
    },
    subscriptionEndAt: {
      type: dt.DATE,
      allowNull: true,
      // Store auto-deactivates after this date
    },

    // ============ STATUS ============
    status: {
      type: dt.ENUM("ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"),
      allowNull: false,
      defaultValue: "INACTIVE",
      // Newly created stores start INACTIVE until payment verified
    },

    // ============ THEME ============
    primaryColor: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "#1d6fff",
    },
    secondaryColor: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "#0b2545",
    },

    // ============ SOCIAL ============
    facebook: {
      type: dt.STRING,
      allowNull: true,
    },
    instagram: {
      type: dt.STRING,
      allowNull: true,
    },
    whatsapp: {
      type: dt.STRING,
      allowNull: true,
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
    tableName: "store-collections",
    timestamps: true,
    indexes: [
      { fields: ["slug"], unique: true },
      { fields: ["storeCode"], unique: true },
      { fields: ["ownerId"], unique: true },
      { fields: ["packageId"] },
      { fields: ["status"] },
      { fields: ["subscriptionEndAt"] },
    ],
  },
);

module.exports = Store;