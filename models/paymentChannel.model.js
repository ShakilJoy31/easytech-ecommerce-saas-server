// models/paymentChannel.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const PaymentChannel = sequelize.define(
  "payment-channel-collections",
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
      unique: true,
      // "bKash", "Nagad", "Rocket", "Bank Transfer"
    },
    slug: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // "bkash", "nagad"
    },
    logo: {
      type: dt.STRING,
      allowNull: true,
      // Icon URL
    },

    // ============ ACCOUNT DETAILS ============
    accountType: {
      type: dt.ENUM("PERSONAL", "MERCHANT", "AGENT", "BANK"),
      allowNull: false,
      defaultValue: "PERSONAL",
    },
    accountNumber: {
      type: dt.STRING,
      allowNull: false,
      // e.g. 01712345678 or bank account no
    },
    accountHolderName: {
      type: dt.STRING,
      allowNull: true,
    },
    bankName: {
      type: dt.STRING,
      allowNull: true,
      // Only for BANK type
    },
    branchName: {
      type: dt.STRING,
      allowNull: true,
    },
    routingNumber: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ INSTRUCTIONS ============
    instructions: {
      type: dt.TEXT,
      allowNull: true,
      // "Send Money to 01712345678 then enter TrxID below"
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
    tableName: "payment-channel-collections",
    timestamps: true,
    indexes: [
      { fields: ["slug"], unique: true },
      { fields: ["name"], unique: true },
      { fields: ["isActive"] },
      { fields: ["displayOrder"] },
    ],
  },
);

module.exports = PaymentChannel;