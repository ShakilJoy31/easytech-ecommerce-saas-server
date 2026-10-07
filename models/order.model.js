// models/order.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const Order = sequelize.define(
  "order-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ IDENTITY ============
    orderNumber: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // Human-readable e.g. ORD-2026-0001
    },
    invoiceNumber: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
      // e.g. INV-2026-0001 (generated on confirm)
    },

    // ============ TENANT ============
    storeId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to store-collections
    },

    // ============ CUSTOMER ============
    customerName: {
      type: dt.STRING,
      allowNull: false,
    },
    customerPhone: {
      type: dt.STRING,
      allowNull: false,
    },
    customerEmail: {
      type: dt.STRING,
      allowNull: true,
      validate: { isEmail: true },
    },
    customerAddress: {
      type: dt.TEXT,
      allowNull: false,
    },
    customerDistrict: {
      type: dt.STRING,
      allowNull: true,
    },
    customerNote: {
      type: dt.TEXT,
      allowNull: true,
    },

    // ============ PRICING ============
    subtotal: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    shippingCost: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    discount: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "BDT",
    },

    // ============ PAYMENT ============
    paymentMethod: {
      type: dt.ENUM("COD", "BKASH", "NAGAD", "BANK", "OTHER"),
      allowNull: false,
      defaultValue: "COD",
    },
    paymentStatus: {
      type: dt.ENUM("UNPAID", "PAID", "PARTIAL", "REFUNDED"),
      allowNull: false,
      defaultValue: "UNPAID",
    },
    paymentReference: {
      type: dt.STRING,
      allowNull: true,
      // TrxID if paid online
    },

    // ============ FULFILLMENT ============
    status: {
      type: dt.ENUM(
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
      ),
      allowNull: false,
      defaultValue: "PENDING",
    },
    deliveredAt: {
      type: dt.DATE,
      allowNull: true,
    },
    cancelledAt: {
      type: dt.DATE,
      allowNull: true,
    },
    cancellationReason: {
      type: dt.TEXT,
      allowNull: true,
    },

    // ============ TRACKING ============
    courierName: {
      type: dt.STRING,
      allowNull: true,
    },
    trackingNumber: {
      type: dt.STRING,
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
    tableName: "order-collections",
    timestamps: true,
    indexes: [
      { fields: ["orderNumber"], unique: true },
      { fields: ["invoiceNumber"], unique: true },
      { fields: ["storeId"] },
      { fields: ["status"] },
      { fields: ["paymentStatus"] },
      { fields: ["customerPhone"] },
      { fields: ["createdAt"] },
    ],
  },
);

module.exports = Order;