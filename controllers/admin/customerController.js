const User = require("../../models/userSchema");



const customerInfo = async (req,res)=>{
    try {
        
        let search = "";
        if(req.query.search){
            search = req.query.search;
        }
        
        let page = parseInt(req.query.page) || 1;

        const limit = 5
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        .sort({createdAt : -1})
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        }).countDocuments();

        res.render('customers', {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page
          });

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const customerBlocked = async (req,res)=>{
    try {
        // let id = req.query.id;
        const { id, page } = req.query;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        // res.redirect("/admin/users")
        res.redirect(`/admin/users?page=${page}`);

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}

const customerunBlocked = async (req,res)=>{
    try {
        // let id = req.query.id;
        const { id, page } = req.query;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        // res.redirect("/admin/users")
        res.redirect(`/admin/users?page=${page}`);

    } catch (error) {
        res.redirect("/admin/pageerror")
    }
}


module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked
}