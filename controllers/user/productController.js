const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Cart = require("../../models/cartSchema");



const getProductDetails = async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId).lean();
  
      if (!product) {
        return res.redirect('/products');
      }
  
      // Attach category name (for breadcrumbs)
      if (product.category) {
        const cat = await Category.findById(product.category).lean();
        product.categoryName = cat ? cat.name : '';
      }
  
      const brandInfo = await Brand.findOne({ brandName: product.brand }).lean();
      product.brandDescription = brandInfo ? brandInfo.brandDescription : '';
  
      product.availableSizes = product.size || [];
      product.colorName = product.color || '';
  

      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        category: product.category,
        isBlocked: false,
        status: "Available"
      })
      .limit(4)
      .lean();
  
      const userId = req.session.user;
      let userData = null;
      if (userId) {
        userData = await User.findById(userId);
      }
      
      const cart = await Cart.findOne({ userId: req.session.user }).lean();

      return res.render("product-details2", {
        user: userData,
        product,
        relatedProducts,
        cart
      });
    } catch (error) {
      console.error("Error in getProductDetails:", error);
      return res.redirect('/products');
    }
  };

  
  module.exports = {
    getProductDetails,

  }