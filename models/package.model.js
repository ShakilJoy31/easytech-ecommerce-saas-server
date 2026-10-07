// models/package.model.js
const { DataTypes: dt } = require("sequelize");
const sequelize = require("../database/connection");

const Package = sequelize.define(
  "package-collections",
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
      // e.g. "Starter", "Pro", "Business"
    },
    slug: {
      type: dt.STRING,
      allowNull: false,
      unique: true,
      // e.g. "starter", "pro", "business"
    },
    description: {
      type: dt.TEXT,
      allowNull: true,
    },

    // ============ PRICING ============
    price: {
      type: dt.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: dt.STRING,
      allowNull: false,
      defaultValue: "BDT",
    },
    durationDay: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 30,
      // e.g. 30 = monthly, 365 = yearly
    },

    // ============ LIMITS ============
    maxProducts: {
      type: dt.INTEGER,
      allowNull: true,
      // null = unlimited
    },
    maxCategories: {
      type: dt.INTEGER,
      allowNull: true,
    },
    maxOrdersPerMonth: {
      type: dt.INTEGER,
      allowNull: true,
    },

    // ============ FEATURES ============
    // ⚠️ We store features as TEXT and handle (de)serialization manually
    //    via getter/setter. This is bulletproof across MySQL / MariaDB
    //    and avoids the "double-encoded JSON string" issue.
    features: {
      type: dt.TEXT,
      allowNull: true,
      defaultValue: "[]",
      get() {
        const raw = this.getDataValue("features");
        if (raw === null || raw === undefined || raw === "") return [];

        // Already an array (paranoid safety)
        if (Array.isArray(raw)) return raw;

        // If it's a string, try to parse
        if (typeof raw === "string") {
          try {
            const parsed = JSON.parse(raw);
            // Handle double-encoded case: '"[\\"a\\",\\"b\\"]"'
            if (typeof parsed === "string") {
              try {
                const doubleParsed = JSON.parse(parsed);
                return Array.isArray(doubleParsed) ? doubleParsed : [];
              } catch {
                return [];
              }
            }
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            // Not JSON at all — return as single-item array or empty
            return [];
          }
        }

        return [];
      },
      set(value) {
        if (value === null || value === undefined) {
          this.setDataValue("features", "[]");
          return;
        }

        // Normalize to array
        let arr = [];
        if (Array.isArray(value)) {
          arr = value.filter((v) => v !== null && v !== undefined);
        } else if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) {
            arr = [];
          } else if (trimmed.startsWith("[")) {
            // Try to parse it as JSON array
            try {
              const parsed = JSON.parse(trimmed);
              arr = Array.isArray(parsed) ? parsed : [trimmed];
            } catch {
              arr = [trimmed];
            }
          } else {
            // Comma-separated fallback
            arr = trimmed
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }

        // Clean each entry to string
        arr = arr.map((f) => String(f).trim()).filter(Boolean);

        this.setDataValue("features", JSON.stringify(arr));
      },
    },

    // ============ DISPLAY ============
    displayOrder: {
      type: dt.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isPopular: {
      type: dt.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: "package-collections",
    timestamps: true,
    indexes: [
      { fields: ["slug"], unique: true },
      { fields: ["name"], unique: true },
      { fields: ["isActive"] },
      { fields: ["displayOrder"] },
    ],
  },
);

module.exports = Package;