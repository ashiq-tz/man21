const express = require("express");
const app = express();
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session")
const MongoStore = require("connect-mongo");

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

app.set('view engine','ejs');
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);

app.use(express.static(path.join(__dirname, 'public'))); 


app.use("/",userRouter);
app.use("/admin",adminRouter);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  


module.exports = app;