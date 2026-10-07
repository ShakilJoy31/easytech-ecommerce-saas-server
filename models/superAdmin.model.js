const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");


const SuperAdmin = sequelize.define(
  "superadmin-collections",
  {
    id: {
      type: dt.INTEGER,
      autoIncrement: true,
      unique: true,
      primaryKey: true,
    },
    // Company Information
    companyName: {
      type: dt.STRING,
      allowNull: false,
    },
    tradeLicenseNo: {
      type: dt.STRING,
      allowNull: true,
      unique: true,
    },
    binNo: {
      type: dt.STRING,
      allowNull: true,
    },
    tinNo: {
      type: dt.STRING,
      allowNull: true,
    },
    // Owner/Contact Person Information
    ownerName: {
      type: dt.STRING,
      allowNull: false,
    },
    ownerPhoto: {
      type: dt.STRING,
      allowNull: true,
    },
    ownerNidOrPassportNo: {
      type: dt.STRING,
      allowNull: true,
    },
    ownerNidFrontSide: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "",
    },
    ownerNidBackSide: {
      type: dt.STRING,
      allowNull: true,
      defaultValue: "",
    },
    // Contact Information
    phoneNo: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
    },
    website: {
      type: dt.STRING,
      allowNull: true,
    },
    // Address
    address: {
      type: dt.TEXT,
      allowNull: false,
    },
    city: {
      type: dt.STRING,
      allowNull: false,
    },
    state: {
      type: dt.STRING,
      allowNull: false,
    },
    postalCode: {
      type: dt.STRING,
      allowNull: true,
    },
    country: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "Bangladesh",
    },
    // Business Details
    businessType: {
      type: dt.STRING,
      allowNull: true,
    },
    yearOfEstablishment: {
      type: dt.INTEGER,
      allowNull: true,
    },
    numberOfEmployees: {
      type: dt.INTEGER,
      allowNull: true,
    },
    // Bank Details
    bankName: {
      type: dt.STRING,
      allowNull: true,
    },
    bankAccountNo: {
      type: dt.STRING,
      allowNull: true,
    },
    bankBranch: {
      type: dt.STRING,
      allowNull: true,
    },
    // System Fields
    role: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "super-admin",
    },
    status: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "pending", //! pending, active, inactive
    },
    password: {
      type: dt.STRING,
      allowNull: false,
    },
    lastLoginAt: {
      type: dt.DATE,
      allowNull: true,
    },
    notes: {
      type: dt.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "superadmin-collections",
    timestamps: true,
  }
);

module.exports = SuperAdmin;