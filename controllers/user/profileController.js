const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");

const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const session = require("express-session");
const { response } = require("express");


function generateOtp(){
    const digits = "1234567890";
    let otp = "";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}

const sendVerificationEmail = async(email,otp)=>{
    try {

        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })

        const mailOptions = {
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP: ${otp}</h4><br></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:",info.messageId);
        return true;

        
    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const securePassword = async(password)=>{
    try {

        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        
    }
}


const getForgotPassPage = async(req,res)=>{
    try {

        res.render("forgot-password");
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid = async(req,res)=>{
    try {

        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);

            if(emailSent){
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP:",otp);
            }else{
                res.json({success:false, message:"Failed to send OTP. Try again"});
            }
        }else{
            res.render("forgot-password",{
                message:"User with this email does not exist"
            });
        }
        
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const verifyForgotPassOtp = async(req,res)=>{
    try {

        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"});
        }
        
    } catch (error) {
        res.status(500).json({success:false, message:"An error occured. Try again"})
    }
}

const getResetPassPage = async(req,res)=>{
    try {

        res.render('reset-password')
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const resendOtp = async(req,res)=>{
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email:",email);

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true, message:"Resend OTP successfull"});
        }
        
    } catch (error) {
        console.error("Error in resend otp",error);
        res.status(500).json({success:false, message:"Internal Server Error"});
    }
}

const postNewPassword = async(req,res)=>{
    try {

        const {newPass1, newPass2} = req.body;
        const email = req.session.email;

        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne({email:email},{$set:{password:passwordHash}})

            res.redirect("/login")
        }else{
            res.render('reset-password',{message:"Passwords do not match"})
        }
        
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;

    // 1) Load the user and populate their orders & products
    const user = await User.findById(userId)
      .populate({
        path: 'orderHistory',
        options: { sort: { createdAt: -1 } },
        populate: { path: 'product', model: 'Product' }
      });

    // 2) Fetch their addresses
    const userAddress = await Address.findOne({ userId });

    // 3) Build your magic referral link
    const host  = req.get('host');     // "localhost:3000"
    const proto = req.protocol;        // "http"
    user.referralLink = `${proto}://${host}/signup?ref=${user.referralCode}`;

    // 4) Render with *one* user object
    res.render('profile', { user, userAddress });
  } catch (error) {
    console.error("Error retrieving profile data", error);
    res.redirect("/pageNotFound");
  }
};
  

const changeEmail = async(req,res)=>{
    try {

        res.render("change-email")        
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changeEmailValid = async (req, res) => {
    try {
      const { email } = req.body;
      // Retrieve current logged in user
      const currentUser = await User.findById(req.session.user);
      
      if (!currentUser || currentUser.email !== email) {
        return res.render("change-email", {
          message: "Please enter your current email correctly."
        });
      }
      
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
  
        res.render("change-email-otp");
        console.log("Email sent:", email);
        console.log("OTP", otp);
      } else {
        res.json("email-error");
      }
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };
  

const verifyEmailOtp = async(req,res)=>{
    try {

        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            req.session.userData = req.body.userData;
            res.render("new-email",{
                userData : req.session.userData,
            })
        }else{
            res.render("change-email-otp",{
                message:"OTP not matching",
                userData:req.session.userData
            }) 
        }
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const updateEmail = async (req, res) => {
    try {
      const newEmail = req.body.newEmail;
      const userId = req.session.user;
      
      // Check if newEmail already exists for another user
      const existingUser = await User.findOne({ email: newEmail });
      if (existingUser) {
        return res.render("new-email", {
          message: "This email is already in use."
        });
      }
      
      await User.findByIdAndUpdate(userId, { email: newEmail });
      res.redirect("/userProfile");
    } catch (error) {
      console.error("Error updating email", error);
      res.redirect("/pageNotFound");
    }
  };
  

const changePassword = async(req,res)=>{
    try {
      // grab the user’s email
      const user = await User.findById(req.session.user);
      req.session.email = user.email;

      return res.redirect("/reset-password");

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changePasswordValid = async(req,res)=>{
    try {
        // const { email } = req.body;
        
        // const currentUser = await User.findById(req.session.user);
        // const userExists = await User.findOne({ email });
      
        // if (!currentUser || currentUser.email !== email) {
        //   return res.render("change-password", {
        //     message: "Please enter your current email correctly."
        //   });
        // }


        // if(userExists){
        //     const otp = generateOtp();
        //     const emailSent = await sendVerificationEmail(email, otp);
        //     if(emailSent){
        //         req.session.userOtp = otp;
        //         req.session.userData = req.body;
        //         req.session.email = email;
                
        //         res.json({
        //             success: true,
        //             redirectUrl: "/change-password-otp" 
        //         });
        //         console.log("OTP:", otp);
        //     } else {
        //         res.json({
        //             success: false,
        //             message: "Failed to send OTP. Please try again",
        //         });
        //     }
        // } else {
        //     res.json({
        //         success: false,
        //         message: "User with this email does not exist"
        //     });
        // }

        return res.redirect("/reset-password");
    } catch (error) {
        console.error("Error in change password validation", error);
       res.redirect("/pageNotFound")
    }
}


const verifyChangePassOtp = async(req,res)=>{
    try {

        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){

            res.json({
                success:true,
                redirectUrl:"/reset-password"
            })

        }else{
            res.json({success:false,message:"OTP not matching"})
        }
        
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured.please try again"})
    }
}

const getChangePasswordOtpPage = (req, res) => {
    try {
      res.render("change-password-otp");
    } catch (error) {
      res.redirect("/pageNotFound");
    }
  };

const addAddress = async(req,res)=>{
    try {
        
        const user = req.session.user;
        res.render("add-address",{user:user , redirect: req.query.redirect })

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

  const postAddAddress = async (req, res) => {
    try {
      const userId = req.session.user;
      const { redirect } = req.body; 
      const userData = await User.findOne({ _id: userId });
      const { addressType, name, city, landmark, state, pincode, phone, altPhone } = req.body;
  
      const userAddress = await Address.findOne({ userId: userData._id });
      if (!userAddress) {
        const newAddress = new Address({
          userId: userData._id,
          address: [{ addressType, name, city, landmark, state, pincode, phone, altPhone }]
        });
        await newAddress.save();
      } else {
        userAddress.address.push({ addressType, name, city, landmark, state, pincode, phone, altPhone });
        await userAddress.save();
      }
  
      // Redirect based on the query parameter
      // Redirect based on the hidden input value:
      if (redirect === 'checkout') {
        res.redirect("/checkout");
      } else {
        res.redirect("/userProfile");
      }
    } catch (error) {
      console.error("Error adding address:", error);
      res.redirect("/pageNotFound");
    }
  };
  

  const editAddress = async(req,res)=>{
    try {

        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id" : addressId,
        });

        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })
        
        if(!addressData){
            return res.redirect("/pageNotFound")
        }

        res.render("edit-address",{address : addressData,user : user, redirect: req.query.redirect });

    } catch (error) {
        console.error("Error in edit address",error)
        res.redirect("/pageNotFound")
    }
  }

  const postEditAddress = async (req, res) => {
    try {
      const data = req.body;
      const { redirect } = req.body; 
      const addressId = req.query.id;
      const user = req.session.user;
      const findAddress = await Address.findOne({ "address._id": addressId });
      if (!findAddress) {
        return res.redirect("/pageNotFound");
      }
  
      await Address.updateOne(
        { "address._id": addressId },
        {
          $set: {
            "address.$": {
              _id: addressId,
              addressType: data.addressType,
              name: data.name,
              city: data.city,
              landmark: data.landmark,
              state: data.state,
              pincode: data.pincode,
              phone: data.phone,
              altPhone: data.altPhone,
            }
          }
        }
      );
  
      // Redirect based on the query parameter
     // Redirect based on the hidden input value:
    if (redirect === 'checkout') {
        res.redirect("/checkout");
      } else {
        res.redirect("/userProfile");
      }
    } catch (error) {
      console.error("Error in edit address", error);
      res.redirect("/pageNotFound");
    }
  };
  

  const deleteAddress = async(req,res)=>{
    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            return res.status(404).send("Address not found")
        }

        await Address.updateOne({
            "address._id":addressId
        },
        {
            $pull : {
                address : {
                    _id : addressId
                }
            }
        }
        )

        res.redirect("/userProfile")
        
    } catch (error) {
        console.error("Error in deleting address",error)
        res.redirect("/pageNotFound")
    }
  }


const getEditProfilePage = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      res.render("profile-edit", { user: userData });
    } catch (error) {
      console.error("Error fetching profile data:", error);
      res.redirect("/pageNotFound");
    }
  };
  
  const updateProfile = async (req, res) => {
    try {
      const userId = req.session.user;
      const { name, phone } = req.body;
      
      if (!/^\d{10}$/.test(phone)) {
        return res.json({
          success: false,
          message: 'Invalid phone number. Must be 10 digits.'
        });
      }
      
      await User.findByIdAndUpdate(userId, { name, phone });
      
      return res.json({
        success: true,
        message: 'Profile updated successfully!'
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.json({
        success: false,
        message: 'Something went wrong. Please try again.'
      });
    }
  };
  

module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    getChangePasswordOtpPage,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    getEditProfilePage,
    updateProfile,

}