const { Op } = require("sequelize");

class modelFiltering {
  filter(req, avoidJSONParse) {

    const {
      order,
      sort,
      role,
      startPrice,
      endPrice,
      startDate,
      endDate,
      startAmount,
      endAmount,
      customDate,
    } = req.query;

    let categories;
    let category;

    if (avoidJSONParse) {
      categories = [];
      category = [];
    } else {
      categories = JSON.parse(req.query?.categories || `[]`);
      category = JSON.parse(req.query?.category || `[]`);
    }

    const limit = Number(req.query?.limit || "10");

    const page = Number(req.query?.page || 1);
    const offset = limit * (page - 1);

    const filters = {};

    if (startPrice && endPrice) {
      filters.price = {
        [Op.between]: [startPrice, endPrice],
      };
    }

    if (startAmount && endAmount) {
      filters.amount = {
        [Op.between]: [startAmount, endAmount],
      };
    }

    if (startDate && endDate && customDate) {
      filters.date = {
        [Op.between]: [startDate, endDate],
      };
    } else if (startDate && endDate) {
      filters.createdAt = {
        [Op.between]: [startDate, endDate],
      };
    }

    const conditions = {
      where: { ...filters },
      order: [],
    };

    if (categories && categories?.length > 0) {
      const words = categories.map((keyword) => ({
        categories: {
          [Op.substring]: keyword.trim(),
        },
      }));
      conditions.where = {
        ...conditions.where,
        [Op.or]: words,
      };
    }

    if (category && category?.length > 0) {
      const words = category.map((keyword) => ({
        category: {
          [Op.substring]: keyword.trim(),
        },
      }));
      conditions.where = {
        ...conditions.where,
        [Op.or]: words,
      };
    }

    if (page && limit) {
      conditions.offset = offset;
      conditions.limit = limit;
    }

    if (sort) {
      conditions.order.push([sort, order === "DESC" ? "DESC" : "ASC"]);
    }

    if (role) {
      conditions.where.role = role;
    }

    return { conditions, limit, page };
  }
}

module.exports = new modelFiltering();
