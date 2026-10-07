

const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const ServerStatus = sequelize.define(
  "server-status",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    status: {
      type: dt.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "server-status",
    timestamps: true,
  }
);

module.exports = ServerStatus;

