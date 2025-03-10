const User = require("../../models/userSchema");

const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt")

const loadHomePage = async (req, res) => {
    try {
      const userId = req.session.user;
      if (userId) {
        const userData = await User.findOne({ _id: userId });
        return res.render("home", { user: userData });
      } else {
        return res.render("home", { user: null });
      }
    } catch (error) {
      console.log("home page not found");
      res.status(500).send("server error");
    }
  };
  
  

const loadSignup = async (req, res) => {
    try {

      const message = req.session.message || "";
      req.session.message = ""; // Clear it
      return res.render("signup", { message });

    } catch (error) {
      console.log("Home page not found");
      res.status(500).send("server error");
    }
  };
  




function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){

    try {

        require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendVerificationEmail(email, otp) {
    try {
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


        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
            
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to: email,
            subject:"Verify Your Account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`

        })

        return info.accepted.length>0

    } catch (error) {
        console.error("Error happened sending email",error);
        return false;
    }

}

const signup = async (req,res)=>{
   
    try {
        const {name,phone,email,password,cpassword} = req.body;

        if(password !== cpassword){
            return res.render('signup',{message:"Password not match"});
        }

        const findUser = await User.findOne({email});
        if (findUser) {
            req.session.message = "User with this email already exist";
            return res.redirect('/signup');
        }

        const otp = generateOtp();
        
        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json("email.error")
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        res.render("verify-otp");
        console.log("OTP sent",otp);

    } catch (error) {
        console.error("signup error",error);
        res.redirect("/pageNotFound")
    }
}


const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash;

    } catch (error) {
        
    }
}

const verifyOtp = async(req,res)=>{
    try {
        
        const {otp} = req.body;

        console.log(otp);

        if(otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash =  await securePassword(user.password);

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash
            })
            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({success:true, redirectUrl:"/"})
        }else{
            res.status(400).json({success:false, message:"Invalid OTP"})
        }

    } catch (error) {

        console.error("Error in Verifying otp",error);
        res.status(500).json({success:false, message:"Error Occured"})
        
    }
}


const resendOtp = async (req,res)=>{
    try {
        
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false, message:"Email not found in session"})
        }

        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP",otp);
            res.status(200).json({success:true, message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false, message:"Failed to resend OTP. Pls Try Again"})
        }

    } catch (error) {
        console.error("Error in resending OTP",error)
        res.status(500).json({success:false, message:"Internal Server Error. Pls Try Again"})
    }
}






// const signuup = async (req,res)=>{
//     const {name,email,phone,password} = req.body;
//     try {
        
//         const newUser = new User({name,email,phone,password});
//         console.log(newUser);

//         await newUser.save();

//         return res.redirect("/signup")

//     } catch (error) {
//         console.error("User savea Error",error);
//         res.status(500).send('internal server error');
//     }
// }








 





const pageNotFound = async (req,res) =>{
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadLogin = async (req,res)=>{
    try {
        if(!req.session.user){
            const message = req.session.message || "";
            req.session.message = ""; // Clear the message after retrieving it
            return res.render("login", { message });
        } else {
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const login = async (req,res)=>{
    try {
        const {email,password} = req.body;

        const findUser = await User.findOne({isAdmin:false,email:email});

        if(!findUser){
            req.session.message = "User not found";
            return res.redirect('/login');
        }
        if(findUser.isBlocked){
            req.session.message = "User is Blocked by Admin";
            return res.redirect('/login');
        }
        
        const passwordMatch = await bcrypt.compare(password,findUser.password)
        
        if(!passwordMatch){
            req.session.message = "Incorrect Password";
            return res.redirect('/login');
        }
        

        req.session.user = findUser._id;
        res.redirect('/')

    } catch (error) {
        
        console.error("login error",error);
        res.render('login',{message:"Login failed. Try again later"})

    }
}

const logout = async(req,res)=>{
    try {

        req.session.destroy((err)=>{
            if(err){
                console.log("Session Destruction Error",err.message);
                return res.redirect('/pageNotFound');
            }
            return res.redirect('/login')
        })
        
    } catch (error) {
        console.log("Logout error",error);
        res.redirect('/pageNotFound')
    }
}



module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout

}