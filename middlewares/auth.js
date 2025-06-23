const User = require ("../models/userSchema");

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next();
            }else{
                req.session.destroy(err => {
                    if (err) console.error("Error destroying session:", err);
                    return res.redirect("/login?message=User%20is%20Blocked%20by%20Admin");
                  });
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("Internal Server Error")
        })
    }else{
        res.redirect("/login");
    }
}

// const adminAuth = (req,res,next)=>{
//     User.findOne({isAdmin:true})
//     .then(data=>{
//         if(data){
//             next();
//         }else{
//             res.redirect("/admin/login")
//         }
//     })
//     .catch(error=>{
//         console.log("Error in adminAuth middleware",error);
//         res.status(500).send("Internal Server Error")
//     })
// }

const adminAuth = (req, res, next) => {
    // 1. Is someone logged in?
    if (!req.session.userId) {
      return res.redirect('/admin/login');
    }
  
    // 2. Load the logged-in user from the DB
    User.findById(req.session.userId)
      .then(user => {
        if (user && user.isAdmin) {
          // 3. They’re an admin: allow access
          next();
        } else {
          // Not an admin (or user not found): kick them to login
          res.redirect('/admin/login');
        }
      })
      .catch(err => {
        console.error('Error in adminAuth middleware:', err);
        res.status(500).send('Internal Server Error');
      });
  };

module.exports = {
    userAuth,
    adminAuth
}