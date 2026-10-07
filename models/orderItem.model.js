// models/order-item.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const OrderItem = sequelize.define(
  "order-item-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },

    // ============ LINKS ============
    orderId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to order-collections
    },
    productId: {
      type: dt.INTEGER,
      allowNull: true,
      // FK to product-collections
      // Nullable so deleting a product doesn't break order history
    },
    storeId: {
      type: dt.INTEGER,
      allowNull: false,
      // FK to store-collections (for fast sales report queries)
    },

    // ============ SNAPSHOT (immutable) ============
    productTitle: {
      type: dt.STRING,
      allowNull: false,
      // Snapshot — survives product deletion
    },
    productImage: {
      type: dt.STRING,
      allowNull: true,
      // Snapshot of thumbnail
    },
    productSku: {
      type: dt.STRING,
      allowNull: true,
    },

    // ============ QUANTITY & PRICING ============
    quantity: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unitPrice: {
      type: dt.FLOAT,
      allowNull: false,
      // Snapshot of product.price at order time
    },
    totalPrice: {
      type: dt.FLOAT,
      allowNull: false,
      // quantity * unitPrice
    },

    // ============ META ============
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "order-item-collections",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["productId"] },
      { fields: ["storeId"] },
    ],
  },
);

module.exports = OrderItem;