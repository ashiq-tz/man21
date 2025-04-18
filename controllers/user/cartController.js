const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const User = require("../../models/userSchema"); 
const Address = require("../../models/addressSchema")

// Helper to check if product is available 
async function isProductAvailable(productId) {
    
    const product = await Product.findById(productId).populate('category');
    
    if (!product || product.isBlocked || product.status !== "Available" || (product.category && product.category.isListed === false)) {
      return null;
    }
    return product;
  }
  

// Add product to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, size } = req.body;

    // Fetch the product first
    const product = await isProductAvailable(productId);
    if (!product) {
      return res.json({ success: false, message: 'Product is not available for purchase.' });
    }

    // Find the variant for the selected size
    const variant = product.variants.find(v => v.size.toString() === size);
    if (!variant || variant.stock < 1) {
      return res.json({ success: false, message: 'Selected size is out of stock.' });
    }
    const availableStock = variant.stock;
    const maxPerUser = product.maxPerUser || 10; // maximum allowed per user for this product

    // Find or create the cart for the user
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if the product with the same size already exists in the cart
    const index = cart.items.findIndex(item => 
      item.productId.toString() === productId && item.size.toString() === size.toString()
    );
    
    if (index > -1) {
      let currentQuantity = cart.items[index].quantity;
      if (currentQuantity >= availableStock) {
        return res.json({ success: false, message: 'No more stock available for this size.' });
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
        return res.json({ success: false, message: 'Selected size is out of stock.' });
      }
      cart.items.push({
        productId,
        size, 
        quantity: 1,
        price: product.salePrice,
        totalPrice: product.salePrice,
      });
    }
    
    await cart.save();

    /// Remove product from the user's wishlist array
    await User.updateOne({ _id: userId },{ $pull: { wishlist: productId } });

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
    let cart = await Cart.findOne({ userId }).populate('items.productId');
    
    // Filter out blocked products:
    if (cart) {
      cart.items = cart.items.filter(item => !item.productId.isBlocked);
    }
    
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
    const { productId,size,action } = req.body;
    
    const product = await Product.findById(productId);
    if (!product){
      return res.json({ success: false, message: 'Product not found.' });
    } 
    
    const maxPerUser = product.maxPerUser || 10;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.json({ success: false, message: 'Cart not found.' });
    
     // Now find the item that matches BOTH productId and size
     const index = cart.items.findIndex(item =>
      item.productId.toString() === productId &&
      item.size.toString() === size.toString()
    );
    if (index === -1) return res.json({ success: false, message: 'Item not found in cart.' });
    
    const itemSize = cart.items[index].size; // size stored in the cart item
    // Get the variant for the stored size
    const variant = product.variants.find(v => v.size.toString() === itemSize.toString());
    const availableStock = variant ? variant.stock : 0;
    
    let currentQuantity = cart.items[index].quantity;
    if (action === 'increment') {
      if (currentQuantity >= availableStock) {
        return res.json({ success: false, message: 'No more stock available for this size.' });
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
    const { productId, size } = req.query;
    let cart = await Cart.findOne({ userId });
    if (!cart) return res.redirect("/cart");
    
    
    cart.items = cart.items.filter(item =>
      !(item.productId.toString() === productId && item.size.toString() === size.toString())
    );


    await cart.save();
    return res.redirect("/cart");
  } catch (error) {
    console.error("Error in removeFromCart:", error);
    res.redirect("/pageNotFound");
  }
};

const checkout = async(req,res)=>{
  const userId = req.session.user;
  const user = await User.findById(userId); 
  const cart = await Cart.findOne({ userId }).populate('items.productId');
  const addressData = await Address.findOne({ userId }); 
  res.render('checkout', {
    cart,
    userAddress: addressData,
    user
  });
}

module.exports = {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeFromCart,
  checkout,
};
