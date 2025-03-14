// controllers/user/userController.js

const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");

const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");

const loadHomePage = async (req, res) => {
  try {
    const userId = req.session.user;
    let userData = null;
    if (userId) {
      userData = await User.findOne({ _id: userId });
    }
    const newArrivals = await Product.find({ isBlocked: false, status: "Available" })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    const trendingSneakers = await Product.find({ isBlocked: false, status: "Available" })
      .sort({ productOffer: -1 })
      .limit(4)
      .lean();
    const featuredProducts = await Product.find({ isBlocked: false, status: "Available" })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();
    const categories = await Category.find({ isListed: true }).lean();
    return res.render("home", {
      user: userData,
      newArrivals,
      trendingSneakers,
      featuredProducts,
      categories
    });
  } catch (error) {
    console.log("home page not found:", error);
    res.status(500).send("server error");
  }
};

const loadSignup = async (req, res) => {
  try {
    const message = req.session.message || "";
    req.session.message = "";
    return res.render("signup", { message });
  } catch (error) {
    console.log("Home page not found");
    res.status(500).send("server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    require('dotenv').config();
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error happened sending email", error);
    return false;
  }
}

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render('signup', { message: "Password not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      req.session.message = "User with this email already exist";
      return res.redirect('/signup');
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email.error");
    }
    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };
    res.render("verify-otp");
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash
      });
      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error in Verifying otp", error);
    res.status(500).json({ success: false, message: "Error Occurred" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend OTP", otp);
      res.status(200).json({ success: true, message: "OTP Resend Successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to resend OTP. Please Try Again" });
    }
  } catch (error) {
    console.error("Error in resending OTP", error);
    res.status(500).json({ success: false, message: "Internal Server Error. Please Try Again" });
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      const message = req.session.message || "";
      req.session.message = "";
      return res.render("login", { message });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email: email });
    if (!findUser) {
      req.session.message = "User not found";
      return res.redirect('/login');
    }
    if (findUser.isBlocked) {
      req.session.message = "User is Blocked by Admin";
      return res.redirect('/login');
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      req.session.message = "Incorrect Password";
      return res.redirect('/login');
    }
    req.session.user = findUser._id;
    res.redirect('/');
  } catch (error) {
    console.error("login error", error);
    res.render('login', { message: "Login failed. Try again later" });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Session Destruction Error", err.message);
        return res.redirect('/pageNotFound');
      }
      return res.redirect('/login');
    });
  } catch (error) {
    console.log("Logout error", error);
    res.redirect('/pageNotFound');
  }
};

const getProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    let query = { isBlocked: false, status: "Available" };

    // Category filter
    if (req.query.category) {
      let catNames = req.query.category;
      if (!Array.isArray(catNames)) {
        catNames = [catNames];
      }
      const cats = await Category.find({ name: { $in: catNames } });
      if (cats && cats.length) {
        query.category = { $in: cats.map(c => c._id) };
      } else {
        query.category = null;
      }
    }

    // Brand filter
    if (req.query.brand) {
      let brands = req.query.brand;
      if (!Array.isArray(brands)) {
        brands = [brands];
      }
      query.brand = { $in: brands };
    }

    // Price filter
    if (req.query.price) {
      let priceRanges = req.query.price;
      if (!Array.isArray(priceRanges)) {
        priceRanges = [priceRanges];
      }
      query.$or = priceRanges.map(range => {
        let [min, max] = range.split('-').map(Number);
        return { salePrice: { $gte: min, $lte: max } };
      });
    }

    // Search filter
    if (req.query.search) {
      query.productName = { $regex: req.query.search, $options: 'i' };
    }

    // Sorting
    let sort = {};
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'priceLow':
          sort.salePrice = 1;
          break;
        case 'priceHigh':
          sort.salePrice = -1;
          break;
        case 'az':
          sort.productName = 1;
          break;
        case 'za':
          sort.productName = -1;
          break;
        case 'newArrivals':
          sort.createdAt = -1;
          break;
        case 'featured':
          sort.featured = -1;
          break;
        case 'popularity':
          sort.popularity = -1;
          break;
        default:
          sort.createdAt = -1;
      }
    } else {
      sort.createdAt = -1;
    }

    // Execute query
    const totalCount = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
    const totalPages = Math.ceil(totalCount / limit);

    // Additional data
    const allBrands = await Brand.find({ isBlocked: false }).lean();
    const categories = await Category.find({ isListed: true }).lean();

    // Render
    res.render("product-list", {
      products,
      currentPage: page,
      totalPages,
      currentBrand: req.query.brand || "",
      currentCategory: req.query.category || "",
      currentPrice: req.query.price || "",
      currentSort: req.query.sortBy || "",
      brands: allBrands,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  getProductsPage
};
