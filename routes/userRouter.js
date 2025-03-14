const express = require("express")
const router = express.Router();
const userController = require("../controllers/user/userController");
const passport = require("../config/passport");
const profileController = require("../controllers/user/profileController")


router.get("/",userController.loadHomePage);

router.get("/pageNotFound",userController.pageNotFound)

router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup)

router.post("/verify-otp",userController.verifyOtp);

router.post("/resend-otp",userController.resendOtp);

router.get("/auth/google",passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
});

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

router.get("/products", userController.getProductsPage);



module.exports = router;