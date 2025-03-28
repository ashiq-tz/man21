// controllers/user/orderController.js
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema"); // for stock adjustments if needed

// Place Order
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, couponCode } = req.body;

    // 1) Find the cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty." });
    }

    // 2) Find the address
    const userAddressDoc = await Address.findOne({ userId });
    if (!userAddressDoc) {
      return res.json({ success: false, message: "No addresses found. Please add an address." });
    }
    // Pick the selected address from the address array
    const selectedAddress = userAddressDoc.address.find((a) => a._id.toString() === addressId);
    if (!selectedAddress) {
      return res.json({ success: false, message: "Selected address not found." });
    }

    // 3) Build the orderedItems array
    let orderedItems = [];
    let totalPrice = 0;
    for (const item of cart.items) {
      const product = item.productId;
      const quantity = item.quantity;
      const price = product.salePrice; 
      const itemTotal = price * quantity;
      totalPrice += itemTotal;

      // If you need to reduce stock, do it here:
      // (optional, only if you want to reduce stock upon order creation)
      // const variantIndex = product.variants.findIndex(v => v.size === item.size);
      // if (variantIndex > -1) {
      //   product.variants[variantIndex].stock -= quantity;
      //   await product.save();
      // }

      orderedItems.push({
        product: product._id,
        quantity,
        price,
      });
    }

    // 4) Handle coupon logic if needed
    let discount = 0;
    let finalAmount = totalPrice - discount;

    // 5) Create the new Order
    const newOrder = new Order({
      orderedItems,
      totalPrice,
      discount,
      finalAmount,
      address: userAddressDoc.userId, // or store the entire selectedAddress if you prefer
      status: "Pending",
      createdAt: Date.now(),
      couponApplied: couponCode ? true : false,
    });
    await newOrder.save();

    // 6) Push the order to the user's orderHistory
    await User.findByIdAndUpdate(userId, {
      $push: { orderHistory: newOrder._id },
    });

    // 7) Clear the cart (if you want to remove all items after ordering)
    cart.items = [];
    await cart.save();

    // 8) Return success with the new orderId
    return res.json({ success: true, orderId: newOrder.orderId }); 
    // or use newOrder._id if you want to display the DB id
  } catch (error) {
    console.error("Error in placeOrder:", error);
    return res.json({ success: false, message: "An error occurred. Please try again." });
  }
};

const orderSuccess = async (req, res) => {
    try {
      const orderId = req.query.orderId;
      // optionally find the order doc if you want to show some details
      // const order = await Order.findOne({ orderId }).lean();
      // pass that info to ejs
  
      res.render("order-success", { orderId });
    } catch (error) {
      console.error("Error in orderSuccess:", error);
      res.redirect("/pageNotFound");
    }
  };

  const cancelOrder = async (req, res) => {
    try {
      const { orderId, cancellationReason } = req.body; // orderId from client, reason optional
  
      // Find the order by orderId (not _id)
      const order = await Order.findOne({ orderId });
      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }
  
      // Update order status and add cancellation reason (if provided)
      order.status = "Cancelled";
      if (cancellationReason) {
        order.cancellationReason = cancellationReason; // make sure your schema supports this if needed
      }
      await order.save();
  
      // For each ordered item, increment the inventory back
      for (const item of order.orderedItems) {
        // Find the product
        const product = await Product.findById(item.product);
        if (product) {
          // Find the corresponding variant by size
          // (Assuming you've stored the size in the order; if not, you might need to add it.)
          const variant = product.variants.find(v => v.size.toString() === item.size.toString());
          if (variant) {
            variant.stock += item.quantity;
          }
          await product.save();
        }
      }
  
      return res.json({ success: true, message: "Order cancelled and inventory updated." });
    } catch (error) {
      console.error("Error cancelling order:", error);
      return res.json({ success: false, message: "An error occurred while cancelling the order." });
    }
  };
  
  module.exports = {
    placeOrder,
    orderSuccess,
    cancelOrder
  };
  