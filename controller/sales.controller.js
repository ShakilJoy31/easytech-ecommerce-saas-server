// controller/sales.controller.js
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../database/connection");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const Category = require("../models/store-owner/category.model");

/* =========================================================================
   Helpers
========================================================================= */
const getDateRange = (range, dateFrom, dateTo) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "last7days":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "last30days":
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "thisYear":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      if (dateFrom) {
        start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
      }
      if (dateTo) {
        end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
      }
      break;
    default:
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
};

const formatMySQLDate = (d) => {
  // Returns 'YYYY-MM-DD HH:mm:ss' for safe raw SQL binding
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* =========================================================================
   OVERVIEW — KPIs + revenue + order counts
========================================================================= */
const getSalesOverview = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { range = "last30days", dateFrom = "", dateTo = "" } = req.query;

    const { start, end } = getDateRange(range, dateFrom, dateTo);
    const startStr = formatMySQLDate(start);
    const endStr = formatMySQLDate(end);

    /* ---------- Order counts + revenue in one raw query ---------- */
    const [row] = await sequelize.query(
      `
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE WHEN paymentStatus = 'PAID' THEN 1 ELSE 0 END) AS paidOrders,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS deliveredOrders,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pendingOrders,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelledOrders,

        COALESCE(SUM(CASE WHEN paymentStatus = 'PAID' THEN total ELSE 0 END), 0) AS grossRevenue,
        COALESCE(SUM(CASE WHEN paymentStatus = 'PAID' THEN subtotal ELSE 0 END), 0) AS netRevenue,
        COALESCE(SUM(CASE WHEN paymentStatus = 'PAID' THEN discount ELSE 0 END), 0) AS totalDiscount,
        COALESCE(SUM(CASE WHEN paymentStatus = 'PAID' THEN shippingCost ELSE 0 END), 0) AS totalShipping,

        COUNT(DISTINCT CASE WHEN paymentStatus = 'PAID' THEN customerPhone END) AS uniqueCustomers
      FROM \`order-collections\`
      WHERE storeId = :storeId
        AND createdAt BETWEEN :start AND :end
      `,
      {
        replacements: { storeId, start: startStr, end: endStr },
        type: QueryTypes.SELECT,
      }
    );

    const paidOrders = Number(row?.paidOrders || 0);
    const grossRevenue = Number(row?.grossRevenue || 0);

    /* ---------- Units sold ---------- */
    const [unitsRow] = await sequelize.query(
      `
      SELECT COALESCE(SUM(oi.quantity), 0) AS unitsSold
      FROM \`order-item-collections\` oi
      INNER JOIN \`order-collections\` o ON o.id = oi.orderId
      WHERE o.storeId = :storeId
        AND o.paymentStatus = 'PAID'
        AND o.createdAt BETWEEN :start AND :end
      `,
      {
        replacements: { storeId, start: startStr, end: endStr },
        type: QueryTypes.SELECT,
      }
    );

    const unitsSold = Number(unitsRow?.unitsSold || 0);
    const avgOrderValue = paidOrders > 0 ? grossRevenue / paidOrders : 0;

    return res.status(200).json({
      success: true,
      message: "Sales overview retrieved successfully!",
      data: {
        range: { start, end, preset: range },
        orders: {
          total: Number(row?.totalOrders || 0),
          paid: paidOrders,
          delivered: Number(row?.deliveredOrders || 0),
          pending: Number(row?.pendingOrders || 0),
          cancelled: Number(row?.cancelledOrders || 0),
        },
        revenue: {
          gross: grossRevenue,
          net: Number(row?.netRevenue || 0),
          discount: Number(row?.totalDiscount || 0),
          shipping: Number(row?.totalShipping || 0),
        },
        metrics: {
          avgOrderValue: Number(avgOrderValue),
          unitsSold,
          uniqueCustomers: Number(row?.uniqueCustomers || 0),
        },
      },
    });
  } catch (error) {
    console.error("Error getting sales overview:", error);
    next(error);
  }
};

/* =========================================================================
   REVENUE CHART — day-by-day (or month-by-month)
========================================================================= */
const getRevenueChart = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { range = "last30days", dateFrom = "", dateTo = "" } = req.query;

    const { start, end } = getDateRange(range, dateFrom, dateTo);
    const startStr = formatMySQLDate(start);
    const endStr = formatMySQLDate(end);

    const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const groupByMonth = dayDiff > 92;
    const dateFormat = groupByMonth ? "%Y-%m" : "%Y-%m-%d";

    /* ---------- Raw grouped query ---------- */
    const rows = await sequelize.query(
      `
      SELECT
        DATE_FORMAT(createdAt, :dateFormat) AS period,
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS revenue
      FROM \`order-collections\`
      WHERE storeId = :storeId
        AND paymentStatus = 'PAID'
        AND createdAt BETWEEN :start AND :end
      GROUP BY DATE_FORMAT(createdAt, :dateFormat)
      ORDER BY period ASC
      `,
      {
        replacements: { storeId, start: startStr, end: endStr, dateFormat },
        type: QueryTypes.SELECT,
      }
    );

    const rowMap = new Map(rows.map((r) => [r.period, r]));
    const data = [];

    if (groupByMonth) {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, "0")}`;
        const found = rowMap.get(key);
        data.push({
          period: key,
          label: cursor.toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
          }),
          orders: found ? Number(found.orders) : 0,
          revenue: found ? Number(found.revenue) : 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const endCopy = new Date(end);
      endCopy.setHours(0, 0, 0, 0);

      while (cursor <= endCopy) {
        const key = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        const found = rowMap.get(key);
        data.push({
          period: key,
          label: cursor.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          }),
          orders: found ? Number(found.orders) : 0,
          revenue: found ? Number(found.revenue) : 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Revenue chart retrieved successfully!",
      data: {
        grouping: groupByMonth ? "month" : "day",
        points: data,
      },
    });
  } catch (error) {
    console.error("Error getting revenue chart:", error);
    next(error);
  }
};

/* =========================================================================
   TOP PRODUCTS — best sellers
========================================================================= */
const getTopProducts = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { range = "last30days", dateFrom = "", dateTo = "", limit = 10 } =
      req.query;

    const { start, end } = getDateRange(range, dateFrom, dateTo);
    const startStr = formatMySQLDate(start);
    const endStr = formatMySQLDate(end);

    const rows = await sequelize.query(
      `
      SELECT
        oi.productId,
        oi.productTitle AS title,
        oi.productImage AS image,
        oi.productSku AS sku,
        SUM(oi.quantity) AS totalQuantity,
        SUM(oi.totalPrice) AS totalRevenue,
        COUNT(DISTINCT oi.orderId) AS orderCount
      FROM \`order-item-collections\` oi
      INNER JOIN \`order-collections\` o ON o.id = oi.orderId
      WHERE o.storeId = :storeId
        AND o.paymentStatus = 'PAID'
        AND o.createdAt BETWEEN :start AND :end
      GROUP BY oi.productId, oi.productTitle, oi.productImage, oi.productSku
      ORDER BY totalQuantity DESC
      LIMIT :limit
      `,
      {
        replacements: {
          storeId,
          start: startStr,
          end: endStr,
          limit: parseInt(limit, 10) || 10,
        },
        type: QueryTypes.SELECT,
      }
    );

    const enriched = rows.map((r) => ({
      productId: r.productId,
      title: r.title,
      image: r.image,
      sku: r.sku,
      totalQuantity: Number(r.totalQuantity),
      totalRevenue: Number(r.totalRevenue),
      orderCount: Number(r.orderCount),
    }));

    return res.status(200).json({
      success: true,
      message: "Top products retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting top products:", error);
    next(error);
  }
};

/* =========================================================================
   RECENT ORDERS
========================================================================= */
const getRecentOrders = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { limit = 5 } = req.query;

    const orders = await Order.findAll({
      where: { storeId },
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
    });

    /* ---------- Fetch items in one query for all orders ---------- */
    const orderIds = orders.map((o) => o.id);
    let itemsByOrder = new Map();

    if (orderIds.length > 0) {
      const items = await OrderItem.findAll({
        where: { orderId: { [Op.in]: orderIds } },
      });
      for (const item of items) {
        const arr = itemsByOrder.get(item.orderId) || [];
        arr.push(item);
        itemsByOrder.set(item.orderId, arr);
      }
    }

    const enriched = orders.map((order) => {
      const items = itemsByOrder.get(order.id) || [];
      return {
        ...order.toJSON(),
        items,
        itemCount: items.length,
        totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      };
    });

    return res.status(200).json({
      success: true,
      message: "Recent orders retrieved successfully!",
      data: enriched,
    });
  } catch (error) {
    console.error("Error getting recent orders:", error);
    next(error);
  }
};

/* =========================================================================
   PAYMENT METHOD BREAKDOWN
========================================================================= */
const getPaymentBreakdown = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { range = "last30days", dateFrom = "", dateTo = "" } = req.query;

    const { start, end } = getDateRange(range, dateFrom, dateTo);
    const startStr = formatMySQLDate(start);
    const endStr = formatMySQLDate(end);

    const rows = await sequelize.query(
      `
      SELECT
        paymentMethod AS method,
        COUNT(*) AS count,
        COALESCE(SUM(total), 0) AS revenue
      FROM \`order-collections\`
      WHERE storeId = :storeId
        AND paymentStatus = 'PAID'
        AND createdAt BETWEEN :start AND :end
      GROUP BY paymentMethod
      ORDER BY revenue DESC
      `,
      {
        replacements: { storeId, start: startStr, end: endStr },
        type: QueryTypes.SELECT,
      }
    );

    const data = rows.map((r) => ({
      method: r.method,
      count: Number(r.count),
      revenue: Number(r.revenue),
    }));

    return res.status(200).json({
      success: true,
      message: "Payment breakdown retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting payment breakdown:", error);
    next(error);
  }
};

/* =========================================================================
   SALES BY CATEGORY
========================================================================= */
const getSalesByCategory = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { range = "last30days", dateFrom = "", dateTo = "" } = req.query;

    const { start, end } = getDateRange(range, dateFrom, dateTo);
    const startStr = formatMySQLDate(start);
    const endStr = formatMySQLDate(end);

    const rows = await sequelize.query(
      `
      SELECT
        p.categoryId AS categoryId,
        SUM(oi.quantity) AS totalQuantity,
        SUM(oi.totalPrice) AS totalRevenue
      FROM \`order-item-collections\` oi
      INNER JOIN \`order-collections\` o ON o.id = oi.orderId
      LEFT JOIN \`product-collections\` p ON p.id = oi.productId
      WHERE o.storeId = :storeId
        AND o.paymentStatus = 'PAID'
        AND o.createdAt BETWEEN :start AND :end
      GROUP BY p.categoryId
      `,
      {
        replacements: { storeId, start: startStr, end: endStr },
        type: QueryTypes.SELECT,
      }
    );

    /* ---------- Resolve category names ---------- */
    const categoryIds = rows
      .map((r) => r.categoryId)
      .filter((id) => id != null);

    const categories = categoryIds.length
      ? await Category.findAll({ where: { id: categoryIds } })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const data = rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryId
        ? catMap.get(r.categoryId)?.title || "Unknown"
        : "Uncategorized",
      totalQuantity: Number(r.totalQuantity),
      totalRevenue: Number(r.totalRevenue),
    }));

    return res.status(200).json({
      success: true,
      message: "Sales by category retrieved successfully!",
      data,
    });
  } catch (error) {
    console.error("Error getting sales by category:", error);
    next(error);
  }
};

module.exports = {
  getSalesOverview,
  getRevenueChart,
  getTopProducts,
  getRecentOrders,
  getPaymentBreakdown,
  getSalesByCategory,
};