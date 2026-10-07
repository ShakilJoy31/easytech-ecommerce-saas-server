// controller/order.controller.js
const { Op } = require("sequelize");
const SSLCommerzPayment = require("sslcommerz-lts");
const sequelize = require("../database/connection");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const Store = require("../models/store.model");
const PaymentTransaction = require("../models/payment-transaction.model");
const Product = require("../models/store-owner/product.model");

/* =========================================================================
   SSLCommerz config
========================================================================= */
const store_id = process.env.SSL_STORE_ID || "linux699074745baa8";
const store_passwd = process.env.SSL_STORE_PASSWORD || "linux699074745baa8@ssl";
const is_live = process.env.SSL_IS_LIVE === "true";

// Backend (API) base URL — receives SSL callbacks
const baseURL = process.env.SERVER_URL;
// Frontend base URL — customers land here after payment
const frontendURL = process.env.CLIENT_URL;

/* =========================================================================
   Helpers
========================================================================= */
const generateTransactionId = () =>
  "TXN_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);

const generateOrderNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Order.count();
  return `ORD-${year}-${String(count + 1).padStart(5, "0")}`;
};

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Order.count({ where: { invoiceNumber: { [Op.ne]: null } } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
};

/* =========================================================================
   CREATE ORDER + INITIATE SSL PAYMENT
   ------------------------------------------------------------------------
   Request body:
   {
     items: [{ productId, quantity }],
     customer: {
       name, phone, email, address, district, note
     },
     shippingCost?: number,
     discount?: number,
     paymentMethod?: "SSLCOMMERZ" (future: COD)
   }
========================================================================= */
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      items,
      customer,
      shippingCost = 0,
      discount = 0,
      paymentMethod = "SSLCOMMERZ",
    } = req.body;

    /* ---------- Validation ---------- */
    if (!items || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Cart is empty!",
      });
    }

    if (!customer || !customer.name || !customer.phone || !customer.address) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Name, phone, and address are required!",
      });
    }

    /* ---------- Verify all items belong to the SAME store ---------- */
    // Simplest model: one order = one store. If multiple stores, split into multiple orders.
    const productIds = items.map((i) => i.productId);
    const products = await Product.findAll({
      where: { id: { [Op.in]: productIds }, isActive: true },
      transaction,
    });

    if (products.length !== productIds.length) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "One or more products are unavailable!",
      });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check that all products belong to same store
    const storeIds = new Set(products.map((p) => p.storeId));
    if (storeIds.size > 1) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "All items must be from the same store. Please checkout each store separately.",
      });
    }
    const storeId = products[0].storeId;

    /* ---------- Verify store is ACTIVE ---------- */
    const store = await Store.findOne({ where: { id: storeId }, transaction });
    if (!store || store.status !== "ACTIVE") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Store is not currently accepting orders.",
      });
    }

    /* ---------- Compute totals + validate stock ---------- */
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      const qty = parseInt(item.quantity, 10) || 1;

      if (qty < 1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Invalid quantity!",
        });
      }

      if (product.trackStock && product.stock < qty) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `"${product.title}" only has ${product.stock} left in stock.`,
        });
      }

      const unitPrice = Number(product.price);
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;

      orderItemsData.push({
        productId: product.id,
        storeId: product.storeId,
        productTitle: product.title,
        productImage: product.thumbnail || (product.images && product.images[0]) || null,
        productSku: product.sku || null,
        quantity: qty,
        unitPrice,
        totalPrice,
      });
    }

    const total = subtotal + Number(shippingCost) - Number(discount);
    if (total <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Order total must be greater than zero!",
      });
    }

    /* ---------- Create Order ---------- */
    const orderNumber = await generateOrderNumber();

    const newOrder = await Order.create(
      {
        orderNumber,
        storeId,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        customerEmail: customer.email?.trim() || null,
        customerAddress: customer.address.trim(),
        customerDistrict: customer.district?.trim() || null,
        customerNote: customer.note?.trim() || null,
        subtotal,
        shippingCost: Number(shippingCost),
        discount: Number(discount),
        total,
        currency: "BDT",
        paymentMethod: "OTHER", // We'll use "OTHER" for SSL and record TrxID
        paymentStatus: "UNPAID",
        status: "PENDING",
      },
      { transaction }
    );

    /* ---------- Create OrderItems ---------- */
    for (const item of orderItemsData) {
      await OrderItem.create(
        {
          orderId: newOrder.id,
          ...item,
        },
        { transaction }
      );
    }

    /* ---------- Create PaymentTransaction (pending) ---------- */
    const tran_id = generateTransactionId();

    await PaymentTransaction.create(
      {
        orderId: newOrder.id,
        storeId,
        transactionId: tran_id,
        amount: total,
        currency: "BDT",
        status: "pending",
        paymentMethod: "SSLCOMMERZ",
        userData: {
          orderNumber: newOrder.orderNumber,
          customer,
        },
      },
      { transaction }
    );

    await transaction.commit();

    /* ---------- Initiate SSLCommerz ---------- */
    const sslData = {
      total_amount: total,
      currency: "BDT",
      tran_id,
      success_url: `${baseURL}/order/payment-success`,
      fail_url: `${baseURL}/order/payment-fail`,
      cancel_url: `${baseURL}/order/payment-cancel`,
      ipn_url: `${baseURL}/order/payment-ipn`,
      shipping_method: "No",
      product_name: `Order ${newOrder.orderNumber}`,
      product_category: "Ecommerce",
      product_profile: "general",
      cus_name: customer.name,
      cus_email: customer.email || "customer@example.com",
      cus_add1: customer.address,
      cus_add2: customer.address,
      cus_city: customer.district || "Dhaka",
      cus_state: customer.district || "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: customer.phone,
      ship_name: customer.name,
      ship_add1: customer.address,
      ship_add2: customer.address,
      ship_city: customer.district || "Dhaka",
      ship_state: customer.district || "Dhaka",
      ship_postcode: "1000",
      ship_country: "Bangladesh",
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(sslData);

    if (apiResponse && apiResponse.GatewayPageURL) {
      return res.status(200).json({
        success: true,
        message: "Order created. Redirecting to payment...",
        data: {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          transactionId: tran_id,
          gatewayUrl: apiResponse.GatewayPageURL,
        },
      });
    } else {
      // Mark transaction as failed
      await PaymentTransaction.update(
        { status: "failed", errorMessage: "Gateway init failed" },
        { where: { transactionId: tran_id } }
      );
      await newOrder.update({ status: "CANCELLED", cancelledAt: new Date() });

      return res.status(500).json({
        success: false,
        message: "Failed to initialize payment gateway. Please try again.",
        error: apiResponse,
      });
    }
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("Error creating order:", error);
    next(error);
  }
};

/* =========================================================================
   PAYMENT SUCCESS CALLBACK
========================================================================= */
const paymentSuccess = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      currency,
      card_no,
      card_issuer,
      card_brand,
      currency_amount,
      risk_level,
    } = req.body;

    console.log("[SSL SUCCESS]", { tran_id, val_id, amount });

    /* ---------- Find payment ---------- */
    const paymentTx = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
      transaction,
    });

    if (!paymentTx) {
      await transaction.rollback();
      return res.redirect(
        `${frontendURL}/payment/success?tran_id=${tran_id}&status=unknown`
      );
    }

    // Idempotency — already processed
    if (paymentTx.status === "completed") {
      await transaction.rollback();
      return res.redirect(
        `${frontendURL}/payment/success?tran_id=${tran_id}`
      );
    }

    /* ---------- Update payment ---------- */
    await paymentTx.update(
      {
        status: "completed",
        valId: val_id,
        bankTransactionId: bank_tran_id,
        cardType: card_type,
        cardNo: card_no,
        cardIssuer: card_issuer,
        cardBrand: card_brand,
        currency: currency || "BDT",
        currencyAmount: currency_amount || null,
        riskLevel: risk_level || null,
        completedAt: new Date(),
      },
      { transaction }
    );

    /* ---------- Update Order ---------- */
    const order = await Order.findOne({
      where: { id: paymentTx.orderId },
      transaction,
    });

    if (order) {
      const invoiceNumber = await generateInvoiceNumber();

      await order.update(
        {
          paymentStatus: "PAID",
          paymentReference: tran_id,
          status: "CONFIRMED",
          invoiceNumber,
        },
        { transaction }
      );

      /* ---------- Decrement stock + increment totalSold ---------- */
      const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
      });

      for (const item of orderItems) {
        if (!item.productId) continue;

        const product = await Product.findOne({
          where: { id: item.productId },
          transaction,
        });

        if (product && product.trackStock) {
          const newStock = Math.max(0, product.stock - item.quantity);
          await product.update(
            {
              stock: newStock,
              totalSold: (product.totalSold || 0) + item.quantity,
            },
            { transaction }
          );
        } else if (product) {
          await product.update(
            { totalSold: (product.totalSold || 0) + item.quantity },
            { transaction }
          );
        }
      }
    }

    await transaction.commit();

    return res.redirect(`${frontendURL}/payment/success?tran_id=${tran_id}`);
  } catch (error) {
    if (transaction && !transaction.finished) {
      try {
        await transaction.rollback();
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
    }
    console.error("[SSL SUCCESS ERROR]", error);
    return res.redirect(`${frontendURL}/payment/fail?tran_id=${req.body?.tran_id}`);
  }
};

/* =========================================================================
   PAYMENT FAIL CALLBACK
========================================================================= */
const paymentFail = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTx = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTx) {
      await paymentTx.update({
        status: "failed",
        errorMessage: "Payment failed at gateway",
      });

      if (paymentTx.orderId) {
        await Order.update(
          { status: "CANCELLED", cancelledAt: new Date() },
          { where: { id: paymentTx.orderId } }
        );
      }
    }

    return res.redirect(`${frontendURL}/payment/fail?tran_id=${tran_id}`);
  } catch (error) {
    console.error("[SSL FAIL ERROR]", error);
    return res.redirect(`${frontendURL}/payment/fail`);
  }
};

/* =========================================================================
   PAYMENT CANCEL CALLBACK
========================================================================= */
const paymentCancel = async (req, res) => {
  try {
    const { tran_id } = req.body;

    const paymentTx = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (paymentTx) {
      await paymentTx.update({ status: "cancelled" });

      if (paymentTx.orderId) {
        await Order.update(
          { status: "CANCELLED", cancelledAt: new Date() },
          { where: { id: paymentTx.orderId } }
        );
      }
    }

    return res.redirect(`${frontendURL}/payment/cancel?tran_id=${tran_id}`);
  } catch (error) {
    console.error("[SSL CANCEL ERROR]", error);
    return res.redirect(`${frontendURL}/payment/cancel`);
  }
};

/* =========================================================================
   PAYMENT IPN (server-to-server)
========================================================================= */
const paymentIpn = async (req, res) => {
  try {
    const { tran_id, val_id, status } = req.body;
    console.log("[SSL IPN]", { tran_id, val_id, status });

    // IPN is a redundant confirmation — success callback already handles it.
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[SSL IPN ERROR]", error);
    res.status(500).json({ success: false });
  }
};

/* =========================================================================
   PUBLIC — Check order status (for success page)
========================================================================= */
const getOrderByTransactionId = async (req, res, next) => {
  try {
    const { tran_id } = req.params;

    const paymentTx = await PaymentTransaction.findOne({
      where: { transactionId: tran_id },
    });

    if (!paymentTx || !paymentTx.orderId) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found!",
      });
    }

    const order = await Order.findOne({ where: { id: paymentTx.orderId } });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    const items = await OrderItem.findAll({ where: { orderId: order.id } });
    const store = await Store.findOne({ where: { id: order.storeId } });

    return res.status(200).json({
      success: true,
      data: {
        order: order.toJSON(),
        items,
        store: store
          ? {
              id: store.id,
              name: store.name,
              slug: store.slug,
              phone: store.phone,
            }
          : null,
        payment: {
          transactionId: paymentTx.transactionId,
          status: paymentTx.status,
          amount: paymentTx.amount,
          completedAt: paymentTx.completedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error getting order by transaction:", error);
    next(error);
  }
};

/* =========================================================================
   STORE OWNER — Get all orders for their store
========================================================================= */
const getStoreOrders = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const {
      page = 1,
      limit = 20,
      status = "",
      paymentStatus = "",
      search = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = { storeId };

    if (status) whereClause.status = status;
    if (paymentStatus) whereClause.paymentStatus = paymentStatus;

    if (search) {
      whereClause[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { customerPhone: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Attach items + count for each order
    const enriched = await Promise.all(
      orders.map(async (order) => {
        const items = await OrderItem.findAll({
          where: { orderId: order.id },
        });
        return {
          ...order.toJSON(),
          items,
          itemCount: items.length,
          totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully!",
      data: enriched,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting store orders:", error);
    next(error);
  }
};

/* =========================================================================
   STORE OWNER — Get single order
========================================================================= */
const getStoreOrderById = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const order = await Order.findOne({ where: { id, storeId } });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    const items = await OrderItem.findAll({ where: { orderId: order.id } });

    return res.status(200).json({
      success: true,
      data: { ...order.toJSON(), items },
    });
  } catch (error) {
    console.error("Error getting order:", error);
    next(error);
  }
};

/* =========================================================================
   STORE OWNER — Update order status
========================================================================= */
const updateOrderStatus = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;
    const { status, paymentStatus, courierName, trackingNumber, cancellationReason } =
      req.body;

    const order = await Order.findOne({ where: { id, storeId } });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }

    const updateData = {};

    if (status !== undefined) {
      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status!",
        });
      }
      updateData.status = status;
      if (status === "DELIVERED") updateData.deliveredAt = new Date();
      if (status === "CANCELLED") {
        updateData.cancelledAt = new Date();
        if (cancellationReason) updateData.cancellationReason = cancellationReason;
      }
    }

    if (paymentStatus !== undefined) {
      const validPayStatuses = ["UNPAID", "PAID", "PARTIAL", "REFUNDED"];
      if (!validPayStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment status!",
        });
      }
      updateData.paymentStatus = paymentStatus;
    }

    if (courierName !== undefined) updateData.courierName = courierName || null;
    if (trackingNumber !== undefined)
      updateData.trackingNumber = trackingNumber || null;

    await order.update(updateData);

    const updated = await Order.findOne({ where: { id } });
    const items = await OrderItem.findAll({ where: { orderId: id } });

    return res.status(200).json({
      success: true,
      message: "Order updated successfully!",
      data: { ...updated.toJSON(), items },
    });
  } catch (error) {
    console.error("Error updating order:", error);
    next(error);
  }
};

/* =========================================================================
   STORE OWNER — Order stats
========================================================================= */
const getOrderStats = async (req, res, next) => {
  try {
    const storeId = req.user.storeId;

    const total = await Order.count({ where: { storeId } });
    const pending = await Order.count({ where: { storeId, status: "PENDING" } });
    const confirmed = await Order.count({
      where: { storeId, status: "CONFIRMED" },
    });
    const shipped = await Order.count({ where: { storeId, status: "SHIPPED" } });
    const delivered = await Order.count({
      where: { storeId, status: "DELIVERED" },
    });
    const cancelled = await Order.count({
      where: { storeId, status: "CANCELLED" },
    });

    // Total revenue (delivered + paid)
    const totalRevenue = await Order.sum("total", {
      where: { storeId, paymentStatus: "PAID" },
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        confirmed,
        shipped,
        delivered,
        cancelled,
        totalRevenue: totalRevenue || 0,
      },
    });
  } catch (error) {
    console.error("Error getting order stats:", error);
    next(error);
  }
};

module.exports = {
  createOrder,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIpn,
  getOrderByTransactionId,
  getStoreOrders,
  getStoreOrderById,
  updateOrderStatus,
  getOrderStats,
};