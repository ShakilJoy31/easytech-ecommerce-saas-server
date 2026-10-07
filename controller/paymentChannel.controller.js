// controller/paymentChannel.controller.js
const { Op } = require("sequelize");
const PaymentChannel = require("../models/paymentChannel.model");
const ManualPayment = require("../models/manualPayment.model");

/* =========================================================================
   Helpers
========================================================================= */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

const transformChannel = (channel) => {
  const data = channel.toJSON ? channel.toJSON() : channel;
  return {
    ...data,
    accountTypeLabel:
      data.accountType === "BANK"
        ? "Bank Transfer"
        : data.accountType.charAt(0) + data.accountType.slice(1).toLowerCase(),
  };
};

/* =========================================================================
   CREATE PAYMENT CHANNEL
========================================================================= */
const createPaymentChannel = async (req, res, next) => {
  try {
    const {
      name,
      logo,
      accountType = "PERSONAL",
      accountNumber,
      accountHolderName,
      bankName,
      branchName,
      routingNumber,
      instructions,
      displayOrder = 0,
      isActive = true,
    } = req.body;

    if (!name || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: "Channel name and account number are required!",
      });
    }

    const nameExists = await PaymentChannel.findOne({ where: { name } });
    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: "A channel with this name already exists!",
      });
    }

    let slug = generateSlug(name);
    let slugExists = await PaymentChannel.findOne({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(name)}-${counter}`;
      slugExists = await PaymentChannel.findOne({ where: { slug } });
      counter++;
    }

    const channel = await PaymentChannel.create({
      name: name.trim(),
      slug,
      logo: logo || null,
      accountType,
      accountNumber: String(accountNumber).trim(),
      accountHolderName: accountHolderName || null,
      bankName: bankName || null,
      branchName: branchName || null,
      routingNumber: routingNumber || null,
      instructions: instructions || null,
      displayOrder: parseInt(displayOrder, 10) || 0,
      isActive: Boolean(isActive),
      createdBy: req.user?.id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Payment channel created successfully!",
      data: transformChannel(channel),
    });
  } catch (error) {
    console.error("Error creating payment channel:", error);
    next(error);
  }
};

/* =========================================================================
   GET ALL PAYMENT CHANNELS
========================================================================= */
const getAllPaymentChannels = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "",
      accountType = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { accountNumber: { [Op.like]: `%${search}%` } },
        { accountHolderName: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isActive !== "" && isActive !== undefined) {
      whereClause.isActive = isActive === "true" || isActive === true;
    }

    if (accountType) {
      whereClause.accountType = accountType;
    }

    const { count, rows: channels } = await PaymentChannel.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset,
      order: [
        ["displayOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Payment channels retrieved successfully!",
      data: channels.map(transformChannel),
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limitNumber),
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting payment channels:", error);
    next(error);
  }
};

/* =========================================================================
   GET PUBLIC PAYMENT CHANNELS (for store owner payment page)
========================================================================= */
const getPublicPaymentChannels = async (req, res, next) => {
  try {
    const channels = await PaymentChannel.findAll({
      where: { isActive: true },
      order: [
        ["displayOrder", "ASC"],
        ["name", "ASC"],
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Active payment channels retrieved successfully!",
      data: channels.map(transformChannel),
    });
  } catch (error) {
    console.error("Error getting public payment channels:", error);
    next(error);
  }
};

/* =========================================================================
   GET CHANNEL BY ID
========================================================================= */
const getPaymentChannelById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const channel = await PaymentChannel.findOne({ where: { id } });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Payment channel not found!",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Payment channel retrieved successfully!",
      data: transformChannel(channel),
    });
  } catch (error) {
    console.error("Error getting payment channel:", error);
    next(error);
  }
};

/* =========================================================================
   UPDATE PAYMENT CHANNEL
========================================================================= */
const updatePaymentChannel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    const existing = await PaymentChannel.findOne({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Payment channel not found!",
      });
    }

    if (updateData.name && updateData.name !== existing.name) {
      const nameExists = await PaymentChannel.findOne({
        where: { name: updateData.name, id: { [Op.ne]: id } },
      });
      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: "A channel with this name already exists!",
        });
      }

      let slug = generateSlug(updateData.name);
      let slugExists = await PaymentChannel.findOne({
        where: { slug, id: { [Op.ne]: id } },
      });
      let counter = 1;
      while (slugExists) {
        slug = `${generateSlug(updateData.name)}-${counter}`;
        slugExists = await PaymentChannel.findOne({
          where: { slug, id: { [Op.ne]: id } },
        });
        counter++;
      }
      updateData.slug = slug;
    }

    if (updateData.displayOrder !== undefined) {
      updateData.displayOrder = parseInt(updateData.displayOrder, 10) || 0;
    }
    if (updateData.isActive !== undefined) {
      updateData.isActive = Boolean(updateData.isActive);
    }

    updateData.updatedBy = req.user?.id || null;

    await PaymentChannel.update(updateData, { where: { id } });
    const updated = await PaymentChannel.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Payment channel updated successfully!",
      data: transformChannel(updated),
    });
  } catch (error) {
    console.error("Error updating payment channel:", error);
    next(error);
  }
};

/* =========================================================================
   DELETE PAYMENT CHANNEL
========================================================================= */
const deletePaymentChannel = async (req, res, next) => {
  try {
    const { id } = req.params;

    const channel = await PaymentChannel.findOne({ where: { id } });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Payment channel not found!",
      });
    }

    const usageCount = await ManualPayment.count({ where: { channelId: id } });
    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete. ${usageCount} payment(s) used this channel. Deactivate it instead.`,
      });
    }

    await PaymentChannel.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Payment channel deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting payment channel:", error);
    next(error);
  }
};

/* =========================================================================
   TOGGLE CHANNEL STATUS
========================================================================= */
const togglePaymentChannelStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const channel = await PaymentChannel.findOne({ where: { id } });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Payment channel not found!",
      });
    }

    const newStatus =
      isActive !== undefined ? Boolean(isActive) : !channel.isActive;

    await PaymentChannel.update(
      { isActive: newStatus, updatedBy: req.user?.id || null },
      { where: { id } }
    );

    const updated = await PaymentChannel.findOne({ where: { id } });

    return res.status(200).json({
      success: true,
      message: `Channel ${newStatus ? "activated" : "deactivated"} successfully!`,
      data: transformChannel(updated),
    });
  } catch (error) {
    console.error("Error toggling channel status:", error);
    next(error);
  }
};

/* =========================================================================
   GET STATS
========================================================================= */
const getPaymentChannelStats = async (req, res, next) => {
  try {
    const total = await PaymentChannel.count();
    const active = await PaymentChannel.count({ where: { isActive: true } });
    const inactive = await PaymentChannel.count({ where: { isActive: false } });

    return res.status(200).json({
      success: true,
      message: "Payment channel statistics retrieved successfully!",
      data: { total, active, inactive },
    });
  } catch (error) {
    console.error("Error getting channel stats:", error);
    next(error);
  }
};

module.exports = {
  createPaymentChannel,
  getAllPaymentChannels,
  getPublicPaymentChannels,
  getPaymentChannelById,
  updatePaymentChannel,
  deletePaymentChannel,
  togglePaymentChannelStatus,
  getPaymentChannelStats,
};