const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session")
const MongoStore = require("connect-mongo");

const User = require("./models/userSchema");

const passport = require("./config/passport")

const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter")
db();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 2 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());


app.use((req,res,next)=>{
  res.set('cache-control','no-store')
  next();
})

// Global middleware to check if the logged-in user is blocked
app.use(async (req, res, next) => {
  // Skip admin routes
  if (req.originalUrl.startsWith('/admin')) {
    return next();
  }

  if (req.session.user) {
    try {
      const user = await User.findById(req.session.user);
      if (user && user.isBlocked) {
        req.session.destroy(err => {
          if (err) console.error("Error destroying session:", err);
          return res.redirect("/login?message=User is Blocked by Admin");
        });
      } else {
        next();
      }
    } catch (error) {
      console.error("Error checking user blocked status:", error);
      next();
    }
  } else {
    next();
  }
});


app.set('view engine','ejs');
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);

app.use(express.static(path.join(__dirname, 'public'))); 

app.use("/admin",adminRouter);
app.use("/",userRouter);

// Global error-handling middleware
// app.use((err, req, res, next) => {
//   console.error("Global Error Handler:", err.stack);
//   if (req.xhr || req.headers.accept.indexOf("json") > -1) {
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   } else {
//     res.status(500).render("pageerror", { error: err });
//   }
// });


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  


module.exports = app;