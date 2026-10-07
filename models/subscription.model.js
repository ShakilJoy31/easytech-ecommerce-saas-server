// models/subscription.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const Subscription = sequelize.define(
  "subscription-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
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
    manualPaymentId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to manual-payment-collections (if activated via manual payment)
    },

    // ============ PERIOD ============
    startAt: {
      type: dt.DATE,
      allowNull: false,
    },
    endAt: {
      type: dt.DATE,
      allowNull: false,
    },
    durationDay: {
      type: dt.INTEGER,
      allowNull: false,
      // Snapshot of package.durationDay at purchase time
    },

    // ============ PRICING SNAPSHOT ============
    price: {
      type: dt.FLOAT,
      allowNull: false,
      // Snapshot of package.price at purchase time
    },
    currency: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "BDT",
    },

    // ============ STATUS ============
    status: {
      type: dt.ENUM("PENDING", "ACTIVE", "EXPIRED", "CANCELLED", "REFUNDED"),
      allowNull: false,
      defaultValue: "PENDING",
    },

    // ============ RENEWAL ============
    isRenewal: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    previousSubscriptionId: {
      type: dt.INTEGER,
      allowNull: true,
      // Chain of renewals
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
    tableName: "subscription-collections",
    timestamps: true,
    indexes: [
      { fields: ["storeId"] },
      { fields: ["packageId"] },
      { fields: ["status"] },
      { fields: ["endAt"] },
      { fields: ["manualPaymentId"] },
    ],
  },
);

module.exports = Subscription;