const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const User = require("../../models/userSchema"); 

// Helper to check if product is available for cart addition
async function isProductAvailable(productId) {
    // Fetch product along with category information if needed
    const product = await Product.findById(productId).populate('category');
    // Change the check to use "Available" and also verify if the product is not blocked
    if (!product || product.isBlocked || product.status !== "Available" || (product.category && product.category.isListed === false)) {
      return null;
    }
    return product;
  }
  

// Add product to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;
    
    // Check product availability
    const product = await isProductAvailable(productId);
    if (!product) {
      return res.json({ success: false, message: 'Product is not available for purchase.' });
    }
    
    const availableStock = product.stock;
    const maxPerUser = product.maxPerUser || 10; // maximum allowed per user for this product

    // Find or create the cart for the user
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product already exists in cart
    const index = cart.items.findIndex(item => item.productId.toString() === productId);
    if (index > -1) {
      let currentQuantity = cart.items[index].quantity;
      if (currentQuantity >= availableStock) {
        return res.json({ success: false, message: 'No more stock available.' });
      }
      if (currentQuantity >= maxPerUser) {
        return res.json({ success: false, message: `You can only add up to ${maxPerUser} of this product.` });
      }
      currentQuantity++;
      cart.items[index].quantity = currentQuantity;
      cart.items[index].totalPrice = product.salePrice * currentQuantity;
    } else {
      // If new, ensure at least one item is available
      if (availableStock < 1) {
        return res.json({ success: false, message: 'Product is out of stock.' });
      }
      cart.items.push({
        productId,
        quantity: 1,
        price: product.salePrice,
        totalPrice: product.salePrice,
      });
    }
    
    await cart.save();

    // Remove product from wishlist if it exists
    await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

    return res.json({ success: true, message: 'Product added to cart.' });
  } catch (error) {
    console.error("Error in addToCart:", error);
    return res.json({ success: false, message: 'An error occurred. Please try again.' });
  }
};

// List products in cart
const getCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId); 

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    res.render("cart", { cart, user });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.redirect("/pageNotFound");
  }
};

// Update quantity (increment or decrement)
const updateCartItemQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, action } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return res.json({ success: false, message: 'Product not found.' });
    
    const availableStock = product.stock;
    const maxPerUser = product.maxPerUser || 10;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ success: false, message: 'Cart not found.' });
    
    const index = cart.items.findIndex(item => item.productId.toString() === productId);
    if (index === -1) return res.json({ success: false, message: 'Item not found in cart.' });
    
    let currentQuantity = cart.items[index].quantity;
    if (action === 'increment') {
      if (currentQuantity >= availableStock) {
        return res.json({ success: false, message: 'No more stock available.' });
      }
      if (currentQuantity >= maxPerUser) {
        return res.json({ success: false, message: `Maximum allowed quantity is ${maxPerUser}.` });
      }
      currentQuantity++;
    } else if (action === 'decrement') {
      if (currentQuantity <= 1) {
        return res.json({ success: false, message: 'Minimum quantity is 1.' });
      }
      currentQuantity--;
    }
    
    cart.items[index].quantity = currentQuantity;
    cart.items[index].totalPrice = product.salePrice * currentQuantity;
    
    await cart.save();
    return res.json({ success: true, message: 'Cart updated successfully.' });
  } catch (error) {
    console.error("Error in updateCartItemQuantity:", error);
    return res.json({ success: false, message: 'An error occurred.' });
  }
};

// Remove product from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.query;
    let cart = await Cart.findOne({ userId });
    if (!cart) return res.redirect("/cart");
    
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();
    return res.redirect("/cart");
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeFromCart,
};
