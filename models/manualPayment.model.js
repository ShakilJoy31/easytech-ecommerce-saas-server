// models/manual-payment.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const ManualPayment = sequelize.define(
  "manual-payment-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
    paymentCode: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // Human-readable ID e.g. PAY-2026-0001
    },

    // ============ LINKS ============
    storeId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to store-collections
    },
    packageId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to package-collections
    },
    channelId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to payment-channel-collections
    },

    // ============ PAYMENT DETAILS ============
    amount: {
      type: dt.FLOAT,
      allowNull: false,
      // Snapshot of package.price
    },
    currency: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "BDT",
    },
    accountNumber: {
      type: dt.STRING,
      allowNull: false,
      // The account number user sent money TO
    },
    senderAccountNumber: {
      type: dt.STRING,
      allowNull: true,
      // The account number user sent money FROM
    },
    transactionId: {
      type: dt.STRING,
      allowNull: false,
      // TrxID from bKash/Nagad
    },
    paymentDate: {
      type: dt.DATE,
      allowNull: true,
    },
    screenshot: {
      type: dt.STRING,
      allowNull: true,
      // Optional payment screenshot URL
    },

    // ============ VERIFICATION ============
    status: {
      type: dt.ENUM("PENDING", "VERIFIED", "REJECTED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    verifiedBy: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to user-collections (SUPER_ADMIN)
    },
    verifiedAt: {
      type: dt.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: dt.TEXT,
      allowNull: true,
    },

    // ============ META ============
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },
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
    tableName: "manual-payment-collections",
    timestamps: true,
    indexes: [
      { fields: ["paymentCode"], unique: true },
      { fields: ["storeId"] },
      { fields: ["packageId"] },
      { fields: ["channelId"] },
      { fields: ["status"] },
      { fields: ["transactionId"] },
      { fields: ["verifiedBy"] },
    ],
  },
);

module.exports = ManualPayment;