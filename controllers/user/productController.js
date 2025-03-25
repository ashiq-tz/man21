const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");


const getProductDetails = async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId).lean();
  
      // If product not found, redirect
      if (!product) {
        return res.redirect('/products');
      }
  
      // Attach category name (for breadcrumbs)
      if (product.category) {
        const cat = await Category.findById(product.category).lean();
        product.categoryName = cat ? cat.name : '';
      }
  
      // If you store brand info in a separate Brand collection,
      // attach brandDescription from there (optional)
      const brandInfo = await Brand.findOne({ brandName: product.brand }).lean();
      product.brandDescription = brandInfo ? brandInfo.brandDescription : '';
  
      product.availableSizes = product.size || [];
      product.colorName = product.color || '';
  
      // Example placeholders for rating, reviews, EMI offers, etc.
      // (Adjust or remove if you store them differently.)
      product.rating = 4.3;
      product.reviewCount = 18;
      product.reviews = [];
      product.emiOffer = 'Rs.677/month | 3/6/9/12 EMI available at 0% interest';
  
      // Fetch related products (same category, different _id, not blocked)
      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        category: product.category,
        isBlocked: false,
        status: "Available"
      })
      .limit(4)
      .lean();
  
      // Fetch full user details if logged in
      const userId = req.session.user;
      let userData = null;
      if (userId) {
        userData = await User.findById(userId);
      }
  
      return res.render("product-details2", {
        user: userData,
        product,
        relatedProducts
      });
    } catch (error) {
      console.error("Error in getProductDetails:", error);
      return res.redirect('/products');
    }
  };

  
  module.exports = {
    getProductDetails,

  }