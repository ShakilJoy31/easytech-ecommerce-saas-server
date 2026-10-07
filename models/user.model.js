// models/user.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const User = sequelize.define(
  "user-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
    name: {
      type: dt.STRING,
      allowNull: false,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: dt.STRING,
      allowNull: false,
      // bcrypt hash
    },
    phone: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ ROLE ============
    role: {
      type: dt.ENUM("SUPER_ADMIN", "STORE_OWNER"),
      allowNull: false,
      defaultValue: "STORE_OWNER",
    },

    // ============ STORE LINK ============
    storeId: {
      type: dt.INTEGER,
      allowNull: true,
      // Null for SUPER_ADMIN, set for STORE_OWNER
    },

    // ============ STATUS ============
    isActive: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLoginAt: {
      type: dt.DATE,
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
    tableName: "user-collections",
    timestamps: true,
    indexes: [
      { fields: ["email"], unique: true },
      { fields: ["role"] },
      { fields: ["storeId"] },
      { fields: ["isActive"] },
    ],
  },
);

module.exports = User;