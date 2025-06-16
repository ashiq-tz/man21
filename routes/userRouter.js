const express = require("express")
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("../config/passport");
const profileController = require("../controllers/user/profileController");
const productController = require("../controllers/user/productController");
const wishlistController = require("../controllers/user/wishlistController");
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderControllers");
const couponController = require("../controllers/user/couponController");

const {userAuth,adminAuth} = require("../middlewares/auth");


router.get("/",userController.loadHomePage);

router.get("/pageNotFound",userController.pageNotFound)

router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup)

router.post("/verify-otp",userController.verifyOtp);

router.post("/resend-otp",userController.resendOtp);

// Google OAuth routes
router.get("/auth/google", passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  "/auth/google/callback",
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    // Assign user id to session so home page can pick it up
    req.session.user = req.user._id;
    console.log("Google Auth Callback Successful. User:", req.user);
    res.redirect('/');
  }
);

router.get('/login',userController.loadLogin);
router.post('/login',userController.login);

router.get('/logout',userController.logout);

//Profile Management
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)

router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage)

router.post("/resend-forgot-otp",profileController.resendOtp);

router.post("/reset-password",profileController.postNewPassword);

router.get("/userProfile",userAuth,profileController.userProfile)

router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValid)
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail)
router.get("/change-password",userAuth,profileController.changePassword)
router.post("/change-password",userAuth,profileController.changePasswordValid)
// router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp)

// router.get("/change-password-otp", userAuth, profileController.getChangePasswordOtpPage);

router.get("/profileEdit", userAuth, profileController.getEditProfilePage);
router.post("/profileEdit", userAuth, profileController.updateProfile);

//Address management
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress)



//Product Management
router.get("/products",userController.getProductsPage);
router.get("/product/:id", productController.getProductDetails);

//Wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProduct)
router.post("/removeAllWishlist", userAuth, wishlistController.removeAllFromWishlist);

//Cart Management
router.post("/addToCart", userAuth, cartController.addToCart);

// Get Cart Page
router.get("/cart", userAuth, cartController.getCart);

// Update item quantity (increment/decrement) via AJAX POST
router.post("/updateCartItemQuantity", userAuth, cartController.updateCartItemQuantity);

// Remove product from cart
router.get("/removeFromCart", userAuth, cartController.removeFromCart);

router.get("/checkout",userAuth,cartController.checkout);


//Orders Management
router.post("/placeOrder", userAuth, orderController.placeOrder);
router.post("/create-razorpay-order", userAuth, orderController.createRazorpayOrder)
router.post("/verify-payment", userAuth, orderController.verifyPayment)
router.get("/orderSuccess", userAuth, orderController.orderSuccess);
router.get("/orderFailure", userAuth, orderController.orderFailure);
router.post("/cancelOrder", userAuth, orderController.cancelOrder);
router.post("/returnOrder", userAuth, orderController.returnOrder);

router.get("/order/details", userAuth, orderController.orderDetails);
router.get("/order/invoice", userAuth, orderController.downloadInvoice);

//Coupon Management
router.post("/validate-coupon", userAuth, couponController.validateCoupon);
router.post("/remove-coupon",userAuth, couponController.removeCoupon)



module.exports = router;