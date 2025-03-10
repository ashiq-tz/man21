const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");

const {userAuth,adminAuth} = require("../middlewares/auth");

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


module.exports = router 
