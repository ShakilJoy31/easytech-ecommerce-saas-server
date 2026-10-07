// models/payment-transaction.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const PaymentTransaction = sequelize.define(
  "payment-transaction-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ============ LINKS ============
    orderId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to order-collections
    },
    storeId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to store-collections (for filtering)
    },

    // ============ IDENTITY ============
    transactionId: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    valId: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ AMOUNT ============
    amount: {
      type: dt.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: dt.STRING,
      defaultValue: "BDT",
    },

    // ============ STATUS ============
    status: {
      type: dt.ENUM("pending", "completed", "failed", "cancelled"),
      defaultValue: "pending",
    },
    paymentMethod: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ CARD / BANK DETAILS ============
    cardType: { type: dt.STRING, allowNull: true },
    cardNo: { type: dt.STRING, allowNull: true },
    cardIssuer: { type: dt.STRING, allowNull: true },
    cardBrand: { type: dt.STRING, allowNull: true },
    bankTransactionId: { type: dt.STRING, allowNull: true },
    currencyAmount: { type: dt.DECIMAL(10, 2), allowNull: true },
    currencyRate: { type: dt.DECIMAL(10, 4), allowNull: true },
    riskLevel: { type: dt.STRING, allowNull: true },
    riskTitle: { type: dt.STRING, allowNull: true },

    // ============ EXTRA ============
    userData: {
      type: dt.JSON,
      allowNull: true,
    },
    errorMessage: {
      type: dt.TEXT,
      allowNull: true,
    },
    completedAt: {
      type: dt.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "payment-transaction-collections",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["storeId"] },
      { fields: ["transactionId"], unique: true },
      { fields: ["status"] },
    ],
  }
);

module.exports = PaymentTransaction;