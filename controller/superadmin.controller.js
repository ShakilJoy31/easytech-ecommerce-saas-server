const { Op } = require("sequelize");
const SuperAdmin = require("../models/superAdmin.model");
const { generateAccessToken, generateRefreshToken } = require("../middleware/jwtHelper");
const sequelize = require("../database/connection");

//! Helper function to transform enterprise response
const transformEnterpriseResponse = (enterprise) => {
  const enterpriseData = enterprise.toJSON ? enterprise.toJSON() : enterprise;
  
  // Remove sensitive data
  delete enterpriseData.password;
  
  // Add document photos object
  enterpriseData.documents = {
    ownerNidFront: enterprise.ownerNidFrontSide || "",
    ownerNidBack: enterprise.ownerNidBackSide || "",
  };
  
  // Format timestamps
  if (enterpriseData.createdAt) {
    enterpriseData.joinedDate = new Date(enterpriseData.createdAt).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  return enterpriseData;
};

//! Create new brother enterprise
const  createBrotherEnterprise = async (req, res, next) => {
  try {
    const {
      // Company Information
      companyName,
      tradeLicenseNo,
      binNo,
      tinNo,
      
      // Owner Information
      ownerName,
      ownerPhoto,
      ownerNidOrPassportNo,
      ownerNidFrontSide,
      ownerNidBackSide,
      
      // Contact Information
      phoneNo,
      email,
      website,
      
      // Address
      address,
      city,
      state,
      postalCode,
      country = "Bangladesh",
      
      // Business Details
      businessType,
      yearOfEstablishment,
      numberOfEmployees,
      
      // Bank Details
      bankName,
      bankAccountNo,
      bankBranch,
      
      // System Fields
      status = "pending",
      role = "brother-enterprise",
      notes,
      
      // Password (will be set to phoneNo if not provided)
      password,
    } = req.body;

    // Validate required fields
    if (!companyName || !ownerName || !phoneNo || !email || !address || !city || !state) {
      return res.status(400).json({
        success: false,
        message: "Company name, owner name, phone number, email, and address are required!",
      });
    }

    // Check if email already exists
    const emailExists = await SuperAdmin.findOne({ where: { email } });
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered!",
      });
    }

    // Check if phone already exists
    const phoneExists = await SuperAdmin.findOne({ where: { phoneNo } });
    if (phoneExists) {
      return res.status(409).json({
        success: false,
        message: "This phone number is already registered!",
      });
    }

    // Check if trade license exists (if provided)
    if (tradeLicenseNo) {
      const licenseExists = await SuperAdmin.findOne({ where: { tradeLicenseNo } });
      if (licenseExists) {
        return res.status(409).json({
          success: false,
          message: "This trade license number is already registered!",
        });
      }
    }

    // Create new enterprise
    const newEnterprise = await SuperAdmin.create({
      // Company Information
      companyName,
      tradeLicenseNo: tradeLicenseNo || null,
      binNo: binNo || null,
      tinNo: tinNo || null,
      
      // Owner Information
      ownerName,
      ownerPhoto: ownerPhoto || null,
      ownerNidOrPassportNo: ownerNidOrPassportNo || null,
      ownerNidFrontSide: ownerNidFrontSide || "",
      ownerNidBackSide: ownerNidBackSide || "",
      
      // Contact Information
      phoneNo,
      email,
      website: website || null,
      
      // Address
      address,
      city,
      state,
      postalCode: postalCode || null,
      country,
      
      // Business Details
      businessType: businessType || null,
      yearOfEstablishment: yearOfEstablishment ? parseInt(yearOfEstablishment) : null,
      numberOfEmployees: numberOfEmployees ? parseInt(numberOfEmployees) : null,
      
      // Bank Details
      bankName: bankName || null,
      bankAccountNo: bankAccountNo || null,
      bankBranch: bankBranch || null,
      
      // System Fields
      role,
      status,
      notes: notes || null,
      password: password || phoneNo, // Default password to phone number if not provided
    });

    // Transform response
    const enterpriseData = transformEnterpriseResponse(newEnterprise);

    // Generate tokens even for pending users (but they can't login until active)
    const userForToken = {
      id: newEnterprise.id,
      email: newEnterprise.email,
      role: newEnterprise.role,
      status: newEnterprise.status,
      companyName: newEnterprise.companyName
    };
    
    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    const responseData = {
      ...enterpriseData,
      tokens: {
        accessToken,
        refreshToken
      },
      accountInfo: {
        id: newEnterprise.id,
        companyName: newEnterprise.companyName,
        email: newEnterprise.email,
        status: newEnterprise.status,
        role: newEnterprise.role,
        message: newEnterprise.status === 'pending' 
          ? "Account created successfully but is pending for approval"
          : "Account created successfully"
      }
    };

    return res.status(201).json({
      success: true,
      message: newEnterprise.status === 'pending' 
        ? "Registration successful! Your account is pending approval." 
        : "Brother Enterprise created successfully!",
      data: responseData,
    });
  } catch (error) {
    console.error("Error creating brother enterprise:", error);
    next(error);
  }
};

//! Get all brother enterprises with pagination and filtering
const getAllBrotherEnterprises = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      city = "",
    } = req.query;

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const offset = (pageNumber - 1) * limitNumber;

    const whereClause = {};

    // Add search functionality
    if (search) {
      whereClause[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { ownerName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phoneNo: { [Op.like]: `%${search}%` } },
        { tradeLicenseNo: { [Op.like]: `%${search}%` } },
      ];
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Add city filter
    if (city) {
      whereClause.city = { [Op.like]: `%${city}%` };
    }

    const { count, rows: enterprises } = await SuperAdmin.findAndCountAll({
      where: whereClause,
      limit: limitNumber,
      offset: offset,
      order: [["createdAt", "DESC"]],
      attributes: { exclude: ["password"] },
    });

    // Transform each enterprise
    const transformedEnterprises = enterprises.map(enterprise => 
      transformEnterpriseResponse(enterprise)
    );

    const totalPages = Math.ceil(count / limitNumber);

    return res.status(200).json({
      success: true,
      message: "Brother enterprises retrieved successfully!",
      data: transformedEnterprises,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: pageNumber,
        itemsPerPage: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error getting brother enterprises:", error);
    next(error);
  }
};

//! Get brother enterprise by ID
const getBrotherEnterpriseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const enterprise = await SuperAdmin.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found!",
      });
    }

    // Transform response
    const enterpriseData = transformEnterpriseResponse(enterprise);

    return res.status(200).json({
      success: true,
      message: "Super Admin retrieved successfully!",
      data: enterpriseData,
    });
  } catch (error) {
    console.error("Error getting super admin by ID:", error);
    next(error);
  }
};

//! Get pending brother enterprise for account activation
const getPendingBrotherEnterpriseForActivation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const enterprise = await SuperAdmin.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found!",
      });
    }

    // Transform response
    const enterpriseData = transformEnterpriseResponse(enterprise);

    return res.status(200).json({
      success: true,
      message: "Pending brother enterprise retrieved successfully!",
      data: enterpriseData,
    });
  } catch (error) {
    console.error("Error getting pending brother enterprise:", error);
    next(error);
  }
};

//! Update brother enterprise
const updateBrotherEnterprise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if enterprise exists
    const existingEnterprise = await SuperAdmin.findOne({ where: { id } });
    if (!existingEnterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found!",
      });
    }

    // Check if new email already exists (if changed)
    if (updateData.email && updateData.email !== existingEnterprise.email) {
      const emailExists = await SuperAdmin.findOne({ 
        where: { email: updateData.email } 
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered!",
        });
      }
    }

    // Check if new phone already exists (if changed)
    if (updateData.phoneNo && updateData.phoneNo !== existingEnterprise.phoneNo) {
      const phoneExists = await SuperAdmin.findOne({ 
        where: { phoneNo: updateData.phoneNo } 
      });
      if (phoneExists) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered!",
        });
      }
    }

    // Check if new trade license already exists (if changed)
    if (updateData.tradeLicenseNo && updateData.tradeLicenseNo !== existingEnterprise.tradeLicenseNo) {
      const licenseExists = await SuperAdmin.findOne({ 
        where: { tradeLicenseNo: updateData.tradeLicenseNo } 
      });
      if (licenseExists) {
        return res.status(409).json({
          success: false,
          message: "This trade license number is already registered!",
        });
      }
    }

    // Parse numeric fields
    if (updateData.yearOfEstablishment) {
      updateData.yearOfEstablishment = parseInt(updateData.yearOfEstablishment);
    }
    if (updateData.numberOfEmployees) {
      updateData.numberOfEmployees = parseInt(updateData.numberOfEmployees);
    }

    // Perform update
    await SuperAdmin.update(updateData, {
      where: { id },
    });

    // Fetch updated enterprise
    const updatedEnterprise = await SuperAdmin.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    // Transform response
    const enterpriseData = transformEnterpriseResponse(updatedEnterprise);

    return res.status(200).json({
      success: true,
      message: "Super Admin updated successfully!",
      data: enterpriseData,
    });
  } catch (error) {
    console.error("Error updating super admin:", error);
    next(error);
  }
};

//! Delete brother enterprise
const deleteBrotherEnterprise = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingEnterprise = await SuperAdmin.findOne({ where: { id } });

    if (!existingEnterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found!",
      });
    }

    await SuperAdmin.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Super Admin deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting super admin:", error);
    next(error);
  }
};

//! Update brother enterprise status (approve/reject)
const updateBrotherEnterpriseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const enterprise = await SuperAdmin.findOne({ where: { id } });
    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found!",
      });
    }

    await SuperAdmin.update({ status }, { where: { id } });

    // Fetch updated enterprise
    const updatedEnterprise = await SuperAdmin.findOne({
      where: { id },
      attributes: { exclude: ["password"] },
    });

    // Transform response
    const enterpriseData = transformEnterpriseResponse(updatedEnterprise);

    return res.status(200).json({
      success: true,
      message: `Super Admin ${status} successfully!`,
      data: enterpriseData,
    });
  } catch (error) {
    console.error("Error updating super admin status:", error);
    next(error);
  }
};

//! Check brother enterprise credentials (login with phone number)
const checkBrotherEnterpriseCredentials = async (req, res, next) => {
  try {
    const { phoneNo, password } = req.body;

    // Check if phone and password are provided
    if (!phoneNo || !password) {
      return res.status(400).json({
        success: false,
        message: "Both phone number and password are required.",
      });
    }

    // Find the enterprise by phone number
    let enterprise = await SuperAdmin.findOne({
      where: { phoneNo },
    });

    // If not found
    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: "Invalid phone number or password.",
      });
    }

    // Check if the password matches
    if (enterprise.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password.",
      });
    }

    // Check status - Only allow login if status is 'active'
    if (enterprise.status.toLowerCase() !== "active") {
      let statusMessage = "";

      if (enterprise.status.toLowerCase() === "pending") {
        statusMessage =
          "Your account is pending approval. You will be able to login once your account is approved.";
      } else if (enterprise.status.toLowerCase() === "inactive") {
        statusMessage =
          "Your account is currently inactive. Please contact support to reactivate your account.";
      } else {
        statusMessage = `Your account status is "${enterprise.status}". Please contact support for assistance.`;
      }

      return res.status(403).json({
        success: false,
        message: statusMessage,
        accountInfo: {
          id: enterprise.id,
          companyName: enterprise.companyName,
          phoneNo: enterprise.phoneNo,
          email: enterprise.email,
          status: enterprise.status,
          role: enterprise.role,
        },
      });
    }

    // Update last login time
    await SuperAdmin.update(
      { lastLoginAt: new Date() },
      { where: { id: enterprise.id } }
    );

    // Remove password from response
    const enterpriseResponse = transformEnterpriseResponse(enterprise);

    // Generate tokens
    const userForToken = {
      id: enterprise.id,
      phoneNo: enterprise.phoneNo,
      email: enterprise.email,
      role: enterprise.role,
      status: enterprise.status,
      companyName: enterprise.companyName
    };
    
    const accessToken = generateAccessToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      data: {
        ...enterpriseResponse,
        tokens: {
          accessToken,
          refreshToken
        }
      },
    });
  } catch (error) {
    console.error("Error checking brother enterprise credentials:", error);
    next(error);
  }
};

//! Change password for brother enterprise
const changeBrotherEnterprisePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation password do not match",
      });
    }

    // Check if new password is different from current password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Find the enterprise
    const enterprise = await SuperAdmin.findOne({
      where: { id },
      attributes: ['id', 'email', 'password', 'companyName', 'role']
    });

    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: "Super Admin not found",
      });
    }

    // Verify current password
    if (enterprise.password !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update the password
    await SuperAdmin.update(
      { password: newPassword },
      { where: { id } }
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        id: enterprise.id,
        email: enterprise.email,
        companyName: enterprise.companyName,
        role: enterprise.role
      }
    });

  } catch (error) {
    console.error("Error changing password:", error);
    next(error);
  }
};

//! Get brother enterprise statistics
const getBrotherEnterpriseStats = async (req, res, next) => {
  try {
    const totalEnterprises = await SuperAdmin.count();
    const activeEnterprises = await SuperAdmin.count({
      where: { status: "active" },
    });
    const pendingEnterprises = await SuperAdmin.count({
      where: { status: "pending" },
    });
    const inactiveEnterprises = await SuperAdmin.count({
      where: { status: "inactive" },
    });

    // Count by city
    const byCity = await SuperAdmin.findAll({
      attributes: [
        "city",
        [sequelize.fn("COUNT", sequelize.col("city")), "count"],
      ],
      group: ["city"],
    });

    return res.status(200).json({
      success: true,
      message: "Super Admin statistics retrieved successfully!",
      data: {
        total: totalEnterprises,
        active: activeEnterprises,
        pending: pendingEnterprises,
        inactive: inactiveEnterprises,
        byCity,
      },
    });
  } catch (error) {
    console.error("Error getting super admin stats:", error);
    next(error);
  }
};

module.exports = {
  createBrotherEnterprise,
  getAllBrotherEnterprises,
  getBrotherEnterpriseById,
  getPendingBrotherEnterpriseForActivation,
  updateBrotherEnterprise,
  deleteBrotherEnterprise,
  updateBrotherEnterpriseStatus,
  checkBrotherEnterpriseCredentials,
  changeBrotherEnterprisePassword,
  getBrotherEnterpriseStats,
};