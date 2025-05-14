
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Banner = require("../../models/bannerSchema");
const walletController = require("../../controllers/user/walletController");

const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");

const loadHomePage = async (req, res) => {
  try {
    const today = new Date().toISOString();
    const findBanner = await Banner.find({
      startDate:{$lt:new Date(today)},
      endDate:{$gt:new Date(today)},
    })

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
      categories,
      banner:findBanner || []
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

    return res.render("signup", { 
      message,
      hideAuthLinks: true,
      referralCode: req.query.ref || ""
    });

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
    const { name, phone, email, password, cpassword, referralCode } = req.body;
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
    req.session.userData = { name, phone, email, password, referralCode: referralCode?.trim() || null};
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
      // 1) Create & save the new user
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash
      });
      await saveUserData.save();

      const refCode = req.session.userData.referralCode;
      if (refCode) {
        const refUser = await User.findOne({ referralCode: refCode });
        // guard: exists, not self, not already in their referredUsers
        if (
          refUser &&
          !refUser._id.equals(saveUserData._id) &&
          !refUser.referredUsers.includes(saveUserData._id)
        ) {
          // 2) Credit ₹200
          await walletController.updateWallet(
            refUser._id,
            200,
            "Referral bonus",
            null,
            "credit"
          );

          // 3) Track in your own fields
          refUser.referralEarnings += 200;
          refUser.referralsCount += 1;
          refUser.referredUsers.push(saveUserData._id);
          await refUser.save();
        }
      }

      delete req.session.userData.referralCode;

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
      const message = req.query.message || req.session.message || "";
      req.session.message = "";
      return res.render("login", { message, hideAuthLinks: true });
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const login = async (req, res) => {
  console.log("Login attempt:", req.body);
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
    // 1) Pagination params
    const page  = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip  = (page - 1) * limit;

    // 2) Build your existing filters (brand/category/search)
    const query = { isBlocked: false, status: "Available" };
    if (req.query.search) {
      query.productName = { $regex: req.query.search, $options: "i" };
    }
    if (req.query.category) {
      let cats = Array.isArray(req.query.category)
        ? req.query.category
        : [req.query.category];
      const catDocs = await Category.find({ name: { $in: cats } }).lean();
      query.category = catDocs.map(c => c._id);
    }
    if (req.query.brand) {
      let brands = Array.isArray(req.query.brand)
        ? req.query.brand
        : [req.query.brand];
      query.brand = { $in: brands };
    }

    // 3) Fetch ALL matching products (no price filter, no sort yet)
    const productsRaw = await Product.find(query)
      .populate("category")
      .lean();

    // 4) Compute finalPrice on each
    let products = productsRaw.map(p => {
      const catOffer  = p.category?.categoryOffer || 0;
      const prodOffer = p.productOffer || 0;
      const bestOffer = Math.max(catOffer, prodOffer);
      const finalPrice   = Math.round(p.regularPrice * (1 - bestOffer / 100));
      return { ...p, bestOffer, finalPrice };
    });

    // 5) In-memory price filtering (on finalPrice)
    if (req.query.price) {
      const ranges = (Array.isArray(req.query.price)
        ? req.query.price
        : [req.query.price]
      ).map(r => r.split("-").map(Number));
      products = products.filter(p =>
        ranges.some(([min, max]) => p.finalPrice >= min && p.finalPrice <= max)
      );
    }

    // 6) In-memory sorting
    const sortBy = req.query.sortBy;
    switch (sortBy) {
      case "priceLow":
        products.sort((a, b) => a.finalPrice - b.finalPrice);
        break;
      case "priceHigh":
        products.sort((a, b) => b.finalPrice - a.finalPrice);
        break;
      case "az":
        products.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case "za":
        products.sort((a, b) => b.productName.localeCompare(a.productName));
        break;
      case "newArrivals":
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "popularity":
        products.sort((a, b) => (b.popularity||0) - (a.popularity||0));
        break;
      default:
        // no sort or you could default to createdAt descending:
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  

    // 7) Compute pagination
    const totalCount = products.length;
    const totalPages = Math.ceil(totalCount / limit);
    const pageItems  = products.slice(skip, skip + limit);

    // 8) Fetch brands & categories for filters UI
    const [allBrands, allCategories] = await Promise.all([
      Brand   .find({ isBlocked: false }).lean(),
      Category.find({ isListed:   true  }).lean()
    ]);

    // 9) Load user if logged in
    const userData = req.session.user
      ? await User.findById(req.session.user)
      : null;

    // 10) Render
    res.render("product-list", {
      user:            userData,
      products:        pageItems,
      currentPage:     page,
      totalPages,
      currentBrand:    req.query.brand    || "",
      currentCategory: req.query.category || "",
      currentPrice:    req.query.price    || "",
      currentSort:     req.query.sortBy   || "newArrivals",
      brands:          allBrands,
      categories:      allCategories,
      searchQuery:     req.query.search   || ""
    });
  } catch (err) {
    console.error("Error in getProductsPage:", err);
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
  getProductsPage,
};
