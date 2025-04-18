const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const bannerController = require("../controllers/admin/bannerController")
const couponController = require("../controllers/admin/couponController")
const orderAdminController = require("../controllers/admin/orderController");

const {userAuth,adminAuth} = require("../middlewares/auth");

const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({storage:storage});

//Admin Login
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)

router.get("/",adminAuth,adminController.loadDashboard);

router.get("/pageerror",adminController.pageerror);

router.get("/logout",adminController.logout);
//Users
router.get("/users",adminAuth,customerController.customerInfo);

router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//Category M
router.get("/category",adminAuth,categoryController.categoryInfo);
router.post("/addCategory",adminAuth,categoryController.addCategory)

router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer);

router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)

//Brand management
router.get("/brands",adminAuth,brandController.getBrandPage);
router.post("/addBrand",adminAuth,uploads.single("image"),brandController.addBrand)
router.get("/blockBrand",adminAuth,brandController.blockBrand)
router.get("/unBlockBrand",adminAuth,brandController.unBlockBrand)
router.get("/deleteBrand",adminAuth,brandController.deleteBrand)

//Product Management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);

router.post("/addProductOffer",adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);

router.get("/blockProduct",adminAuth,productController.blockProduct);
router.get("/unblockProduct",adminAuth,productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);

router.post("/editProduct/:id", adminAuth, uploads.fields([
    { name: 'image1' },
    { name: 'image2' },
    { name: 'image3' },
    { name: 'image4' }
  ]), productController.editProduct);
  
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);

//Banner Management
router.get("/banner",adminAuth,bannerController.getBannerPage)
router.get("/addBanner",adminAuth,bannerController.getAddBannerPage);
router.post("/addBanner",adminAuth,uploads.single("images"),bannerController.addBanner)
router.get("/deleteBanner",adminAuth,bannerController.deleteBanner)

//Coupon Management
router.get("/coupon",adminAuth,couponController.loadCoupon)
router.post("/createCoupon",adminAuth,couponController.createCoupon)
router.get("/editCoupon",adminAuth,couponController.editCoupon)
router.post("/updateCoupon",adminAuth,couponController.updateCoupon)
router.get("/deleteCoupon",adminAuth,couponController.deleteCoupon)

// Orders Management
router.get("/orders", adminAuth, orderAdminController.loadOrders);

router.get("/order/details/:orderId", adminAuth, orderAdminController.orderDetails);
router.post("/order/details/:orderId", adminAuth, orderAdminController.updateOrderDetailsStatus);


module.exports = router 
