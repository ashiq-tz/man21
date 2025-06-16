const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");


const loadWishlist = async(req,res)=>{
    try {

        const userId = req.session.user;
        const user = await User.findById(userId);
        const products = await Product.find({_id:{$in:user.wishlist}}).populate('category');

        // Pagination parameters
        const currentPage = parseInt(req.query.page) || 1;
        const limit = 8; 
        const totalItems = products.length;
        const totalPages = Math.ceil(totalItems / limit);
        const skip = (currentPage - 1) * limit;
    
        // Get only the products for the current page
        const paginatedItems = products.slice(skip, skip + limit);

        res.render("wishlist",{
            user,
            wishlistItems : paginatedItems,
            totalPages,
            currentPage,
            totalItems
        })
        
    } catch (error) {
        console.error(error)
        res.redirect("/pageNotFound")
    }
}

const addToWishlist = async(req,res)=>{
    try {

        const productId = req.body.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);

        if(user.wishlist.includes(productId)){
            user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
            await user.save();
            return res.status(200).json({
                status: false,    
                removed: true,
                message: 'Product Removed from Wishlist'
            });
        }

        user.wishlist.push(productId);
        await user.save();
        return res.status(200).json({status:true,added: true,message:'Product added to Wishlist'})
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({status:false,message:'Server Error'})
    }
}

const removeProduct = async(req,res)=>{
    try {

        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);

        const index = user.wishlist.indexOf(productId);
        user.wishlist.splice(index,1);
        await user.save()

        return res.redirect("/wishlist")
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({status:false,message:'Server Error'})
    }
}

const removeAllFromWishlist = async (req, res) => {
    try {
      const userId = req.session.user;
      const user = await User.findById(userId);
      user.wishlist = [];
      await user.save();
      return res.status(200).json({ status: true, message: 'All wishlist items removed.' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: false, message: 'Server Error' });
    }
};


module.exports = {
    loadWishlist,
    addToWishlist,
    removeProduct,
    removeAllFromWishlist
}