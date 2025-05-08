
const { v4: uuidv4 } = require("uuid");
const crypto = require('crypto');
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");

const walletController = require("../../controllers/user/walletController");

const PDFDocument = require('pdfkit');

const Razorpay = require("razorpay");
var razorpayInstance = new Razorpay({
  key_id: "rzp_test_Fwu0LGrzQ8ECFQ",
  key_secret: "ChsG59WqjDv71mNV489VOyEj",
});

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, couponCode } = req.body;

    //Fetch the cart 
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty." });
    }

    //user's address
    const userAddressDoc = await Address.findOne({ userId });
    if (!userAddressDoc || !userAddressDoc.address || userAddressDoc.address.length === 0) {
      return res.json({ success: false, message: "No addresses found. Please add an address." });
    }
    const selectedAddress = userAddressDoc.address.find((a) => a._id.toString() === addressId);
    if (!selectedAddress) {
      return res.json({ success: false, message: "Selected address not found." });
    }

    // cartTotal
    const cartTotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

     // enforce COD limit
    if (paymentMethod === 'COD' && cartTotal > 5000) {
      return res.json({
        success: false,
        message: 'Cash on Delivery is only available for orders up to ₹5,000.'
      });
    }

    // Coupon validation & usage
    let discount    = 0;
    let couponDoc   = null;
    if (couponCode) {
      couponDoc = await Coupon.findOne({name: couponCode.toUpperCase(),isDeleted: false});
       
      const now = new Date();
      if (
        couponDoc &&
        now >= couponDoc.createdOn &&
        now <= couponDoc.expireOn &&
        cartTotal >= couponDoc.minimumPrice &&
        !couponDoc.usedBy.includes(userId)
      ) {
        discount = couponDoc.offerPrice;
        // mark as used
        couponDoc.usedBy.push(userId);
        await couponDoc.save();
      }
    }

    const groupOrderId = uuidv4();
    let createdOrderIds = [];

    //each item in the cart, create a separate order 
    for (const item of cart.items) {
      const product = item.productId;
      const size = item.size;
      const quantity = item.quantity;
      const itemUnitPrice = item.price;
      const regularTotal = product.regularPrice * quantity;
      const itemTotal    = itemUnitPrice * quantity;

      const productDiscount = regularTotal - itemTotal;

      const couponAmount = discount > 0 
      ? Math.round((itemTotal / cartTotal) * discount): 0;

      const finalAmount = itemTotal - couponAmount;
      
      const variantIndex = product.variants.findIndex(
        (v) => v.size.toString() === size.toString()
      );
      if (variantIndex > -1) {
        product.variants[variantIndex].stock -= quantity;
        await product.save();
      } else {
        console.log(`Variant with size ${size} not found for product ${product._id}`);
      }

      // Create new Order document for the current item
      const newOrder = new Order({
        groupOrderId,
        product: product._id,
        size,
        quantity,
        price: itemUnitPrice,
        totalPrice: itemTotal,
        productDiscount,
        couponAmount,
        finalAmount,
        address: selectedAddress,
        status: "Pending",
        createdAt: Date.now(),
        paymentMethod,
        couponApplied: couponAmount > 0,
        couponCode: couponAmount > 0 ? couponCode.toUpperCase() : null
      });

      await newOrder.save();
      createdOrderIds.push(newOrder.orderId);

      //update user's order history
      await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });
    }

    //clear cart 
    cart.items = [];
    await cart.save();

    //Return success along with the created order IDs
    return res.json({ success: true, orderIds: createdOrderIds, groupOrderId });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    return res.json({ success: false, message: "An error occurred. Please try again." });
  }

};

const createRazorpayOrder = async (req, res) => {
  try {

    const { amount } = req.body;
    let groupOrderId = req.body.groupOrderId;  
    if (!groupOrderId) {
      groupOrderId = uuidv4();
    }

    const options = {
      amount: amount * 100,
      currency: "INR", 
      receipt: groupOrderId
    }
    const order = await razorpayInstance.orders.create(options)
    console.log(order)
    return res.json({ success: true, order, groupOrderId })
  } catch (err) {
    console.error("Razorpay order creation failed:", err)
    return res.status(500).json({ success: false, message: "Unable to create payment order" })
  }
}


// 2.2 Verify payment & then place your MongoDB orders
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
      couponCode,
      groupOrderId
    } = req.body

    //verify signature
    const generated_signature = crypto
      .createHmac('sha256', "ChsG59WqjDv71mNV489VOyEj")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" })
    }

    

    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    const selectedAddressDoc = await Address.findOne({ userId: req.session.user });
      if (!selectedAddressDoc || !selectedAddressDoc.address || selectedAddressDoc.address.length === 0) {
        return res.status(400).json({ success: false, message: "No address found for the user" });
      }

      // Find the specific address using the addressId
    const selectedAddress = selectedAddressDoc.address.find(a => a._id.toString() === addressId.toString());
      if (!selectedAddress) {
        return res.status(400).json({ success: false, message: "Specified address not found" });
      }

     // cartTotal
     const cartTotal = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Coupon logic
    let discount  = 0;
    let couponDoc = null;
    if (couponCode) {
      couponDoc = await Coupon.findOne({
        name: couponCode.toUpperCase(),
        isDeleted: false
      });
      const now = new Date();
      if (
        couponDoc &&
        now >= couponDoc.createdOn &&
        now <= couponDoc.expireOn &&
        cartTotal >= couponDoc.minimumPrice &&
        !couponDoc.usedBy.includes(userId)
      ) {
        discount = couponDoc.offerPrice;
        couponDoc.usedBy.push(userId);
        await couponDoc.save();
      }
    }

    // Creating ordersss
    let createdOrderIds = [];
    for (let item of cart.items) {

      const product = item.productId;
      const size = item.size;
      const quantity = item.quantity;
      const price = item.price;
      // const itemTotal = item.totalPrice;
      const regularTotal = product.regularPrice * quantity;
      const itemTotal    = price * quantity;

      const productDiscount = regularTotal - itemTotal;

      // 2) Coupon allocation = proportion of coupon total
      const couponAmount   = discount > 0
      ? Math.round((itemTotal / cartTotal) * discount): 0;


      // 3) Final price after coupon
      const finalAmount = itemTotal - couponAmount;

      // const itemDiscount = Math.round((itemTotal / cartTotal) * discount);
      // // const finalAmount  = itemTotal - itemDiscount;

      const newOrder = new Order({
        groupOrderId,
        product: product._id,
        size,
        quantity,
        price,
        totalPrice: itemTotal,
        productDiscount,      // ← NEW
        couponAmount,         // ← NEW
        finalAmount,
        address: selectedAddress,    // see note below
        status: "Processing",
        paymentMethod: "Razorpay",
        couponApplied: couponAmount > 0,
        couponCode: couponAmount > 0 ? couponCode.toUpperCase() : null
      });
      await newOrder.save();
      createdOrderIds.push(newOrder.orderId);

      // push to user orderHistory
      await User.findByIdAndUpdate(userId, {
        $push: { orderHistory: newOrder._id },
      });
    }

    // clear cart
    cart.items = [];
    await cart.save();

    res.json({ success: true, orderIds: createdOrderIds, groupOrderId });

  } catch (err) {
    console.error("Razorpay verify error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }

}




const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const { groupOrderId } = req.query;
    const user = await User.findById(userId); 
    const orderId = req.query.orderId;
    
    
    res.render("order-success", { user,groupOrderId,orderId });
  } catch (error) {
    console.error("Error in orderSuccess:", error);
    res.redirect("/pageNotFound");
  }
};

const orderFailure = async (req, res) => {
  try {
    const { groupOrderId, amount, addressId, couponCode } = req.query;
    // render a new failure page, passing along all the bits we need to retry
    res.render("order-failure", {
      groupOrderId,
      amount,
      addressId,
      couponCode: couponCode || ""
    });
  } catch (err) {
    console.error("Error in orderFailure:", err);
    res.redirect("/pageNotFound");
  }
};



const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
   
    const order = await Order.findOne({ orderId }).populate('product');
    if (!order) {
      console.log("Order not found:", orderId);
      return res.json({ success: false, message: "Order not found" });
    }

    //stock update
    const variant = order.product.variants.find(v => 
      v.size.toString() === order.size.toString()
    );
    if (variant && order.status !== "Cancelled") {
      variant.stock += order.quantity;
      await order.product.save();
    }

    order.status = "Cancelled";

    await order.save();

    //wallet
    const refundAmount = order.finalAmount;
    const userId = req.session.user;

    await walletController.updateWallet(
      userId,
      refundAmount,
      'Refund - Order Cancelled',
      order.orderId,
      'credit'
    );

    return res.json({ success: true, message: "Order cancelled successfully." });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.json({ success: false, message: "An error occurred while cancelling the order." });
  }
};


const returnOrder = async (req, res) => {
  try {
    const { orderId, returnReason } = req.body;
    //order
    const order = await Order.findOne({ orderId }).populate('product');
    if (!order) {
      console.log("Order not found:", orderId);
      return res.json({ success: false, message: "Order not found" });
    }

   
    if (order.status !== "Delivered") {
      return res.json({ success: false, message: "Only delivered orders can be returned." });
    }

  
    order.status = "Return Requested";
    if (returnReason) {
      order.returnReason = returnReason;
    }

    await order.save();

    //refund amount
    const refundAmount = order.finalAmount;
    const userId = req.session.user;

    await walletController.updateWallet(
      userId,
      refundAmount,
      'Refund - Order Returned',
      order.orderId,
      'credit'
    );

    return res.json({ success: true, message: "Return processed successfully." });
  } catch (error) {
    console.error("Error processing return:", error);
    return res.json({ success: false, message: "An error occurred while processing the return." });
  }
};

const orderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId); 
    const { orderId } = req.query;
   
    const order = await Order.findOne({ orderId })
      .populate('product')
      .populate('address');
    if (!order) {
      return res.redirect('/pageNotFound');
    }
    res.render("order-details", { order,user });
  } catch (error) {
    console.error("Error in orderDetails:", error);
    res.redirect('/pageNotFound');
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.query;
   
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      return res.status(404).send("Order not found");
    }
    
    // Create a new PDF document
    const doc = new PDFDocument();
    
    // Set response headers to indicate a downloadable PDF file
    res.setHeader('Content-disposition', 'attachment; filename=invoice_' + orderId + '.pdf');
    res.setHeader('Content-type', 'application/pdf');
    
    // Pipe the PDF into the response
    doc.pipe(res);
    
    // Add some content to the invoice (you can style it as needed)
    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Order ID: ${order.orderId}`);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Total: ₹${order.finalAmount}`);
    doc.moveDown();
    
    doc.text('Items:', { underline: true });
    order.orderedItems.forEach((item, index) => {
      doc.moveDown(0.5);
      const productName = item.product?.productName || "Unknown Product";
      doc.text(`${index + 1}. ${productName} - Qty: ${item.quantity} - Price: ₹${item.price}`);
    });
    
    // Finalize the PDF and end the stream
    doc.end();
    
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).send("Error generating invoice");
  }
};

module.exports = {
  placeOrder,
  orderSuccess,
  orderFailure,
  cancelOrder,
  returnOrder,
  orderDetails,
  downloadInvoice,
  createRazorpayOrder,
  verifyPayment
};

