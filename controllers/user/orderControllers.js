
const crypto = require('crypto');
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");

const walletController = require("../../controllers/user/walletController");

const PDFDocument = require('pdfkit');

function makeGroupOrderId() {
  const dt   = Date.now();                          
  const randm = Math.floor(Math.random() * 900 + 100); //100–999
  return `GRP${dt}${randm}`;                       
}


const Razorpay = require("razorpay");
var razorpayInstance = new Razorpay({
  key_id: "rzp_test_Fwu0LGrzQ8ECFQ",
  key_secret: "ChsG59WqjDv71mNV489VOyEj",
});

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, couponCode } = req.body;

    //fetch the cart 
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

    const groupOrderId = makeGroupOrderId();
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

      //update userss order history
      await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });
    }

    //clear cart 
    cart.items = [];
    await cart.save();

    delete req.session.coupon;

    //return success with the created order IDs
    return res.json({ success: true, orderIds: createdOrderIds, groupOrderId });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    return res.json({ success: false, message: "An error occurred. Please try again." });
  }

};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, groupOrderId: incomingGroup } = req.body;
    if (typeof amount !== "number") {
      console.error("🚨 Invalid amount:", amount);
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    const groupOrderId = incomingGroup || makeGroupOrderId();
    const options = { amount: Math.round(amount * 100), currency: "INR", receipt: groupOrderId };
    console.log("→ Razorpay.create order with:", options);
    const order = await razorpayInstance.orders.create(options);
    console.log("← Razorpay order created:", order);
    return res.json({ success: true, order, groupOrderId });
  } catch (err) {
    console.error("❌ createRazorpayOrder failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// Verify payment & then place order
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


      // final price after coupon
      const finalAmount = itemTotal - couponAmount;

      // decrement stock for this variant
      const variantIndex = product.variants.findIndex(
        v => v.size.toString() === size.toString()
      );
      if (variantIndex > -1) {
        product.variants[variantIndex].stock -= quantity;
        await product.save();
      } else {
        console.warn(`Variant ${size} not found for product ${product._id}`);
      }

      const newOrder = new Order({
        groupOrderId,
        product: product._id,
        size,
        quantity,
        price,
        totalPrice: itemTotal,
        productDiscount,      
        couponAmount,         
        finalAmount,
        address: selectedAddress,    
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

    delete req.session.coupon;

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
    // render a new failure page
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
    if (!orderId) return res.status(400).send('Missing orderId');

    // 1) Load main order & its group items
    const master = await Order.findOne({ orderId }).populate('address');
    if (!master) return res.status(404).send('Order not found');
    const items = await Order.find({ groupOrderId: master.groupOrderId })
                             .populate('product');

    // 2) Compute totals
    const subtotal   = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalCoupon = items.reduce((sum, i) => sum + (i.couponAmount || 0), 0);
    const finalAmount = subtotal - totalCoupon;

    // 3) Start PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader(
      'Content-disposition',
      `attachment; filename=invoice_${master.groupOrderId}.pdf`
    );
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // heaader
    // Company name 
    doc
      .font('Helvetica-Bold').fontSize(22)
      .text('MAN21', 50, 50);

    // Company address 
    doc
      .font('Helvetica').fontSize(10)
      .text('MAN21', 0, 50, { align: 'right' })
      .moveDown(0.2)
      .text('123 Main Street', { align: 'right' })
      .moveDown(0.2)
      .text('Malappuram, Kerala, 659679', { align: 'right' });

    // title invoice
    const invoiceY = 100;
    doc
      .font('Helvetica-Bold').fontSize(18)
      .text('Invoice', 50, invoiceY)
      .moveTo(50, invoiceY + 20)
      .lineTo(545, invoiceY + 20)
      .stroke();

    // 
    const metaY = invoiceY + 30;
    // Left side
    doc
      .font('Helvetica').fontSize(10)
      .text('Invoice Number:', 50, metaY)
      .text('Invoice Date:',   50, metaY + 15)
      .text('Payment Method:',    50, metaY + 30);

    doc
      .font('Helvetica-Bold')
      .text(master.groupOrderId,          140, metaY)
      .text(new Date(master.createdAt).toLocaleDateString(), 140, metaY + 15)
      .text(`${master.paymentMethod}`,          140, metaY + 30);

    // Right side
    doc
      .font('Helvetica-Bold').text(master.address.name, 360, metaY)
      .font('Helvetica').text(master.address.addressType,    360, metaY + 15)
      .text(`${master.address.city}, ${master.address.state} - ${master.address.pincode}`, 360, metaY + 30);

    // bottom separator under meta
    doc
      .moveTo(50, metaY + 50)
      .lineTo(545, metaY + 50)
      .stroke();

    // table items
    const tableTop = metaY + 70;
    // Header row
    doc
      .font('Helvetica-Bold').fontSize(10)
      .text('No:',        50,  tableTop)
      .text('Product', 120, tableTop)
      .text('Unit Price',   320, tableTop, { width: 60, align: 'right' })
      .text('Quantity',    400, tableTop, { width: 60, align: 'right' })
      .text('Total',  480, tableTop, { width: 60, align: 'right' });

    // line under header
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(545, tableTop + 15)
      .stroke();

    // Data rows
    let y = tableTop + 25;
    items.forEach((i, idx) => {
      const lineTotal = i.price * i.quantity;
      doc
        .font('Helvetica').fontSize(10)
        .text(idx + 1, 50, y)
        .text(i.product.productName, 120, y)
        .text(`${i.price.toLocaleString('en-IN')}`, 300, y, { width: 60, align: 'right' })
        .text(i.quantity, 380, y, { width: 60, align: 'right' })
        .text(`${lineTotal.toLocaleString('en-IN')}`, 480, y, { width: 60, align: 'right' });
      y += 20;
      
    });

    // summary part
    y += 15;
    doc
      .font('Helvetica-Bold').fontSize(10)
      .text('Subtotal',   400, y,     { width: 80, align: 'right' })
      .text(`${subtotal.toLocaleString('en-IN')}`, 480, y, { width: 60, align: 'right' })

      doc
      .font('Helvetica-Bold')
      .text('Coupon',     400, y + 15, { width: 80, align: 'right' })
      .text(`${totalCoupon.toLocaleString('en-IN')}`, 480, y + 15, { width: 60, align: 'right' });

    doc
      .font('Helvetica-Bold')
      .text('Final Amount',400, y + 30, { width: 80, align: 'right' })
      .text(`${finalAmount.toLocaleString('en-IN')}`, 480, y + 30, { width: 60, align: 'right' });  

    // footer
    doc
      .font('Helvetica').fontSize(10)
      .text(
        '"Thank You For Shopping With Us"',
        50,
        780,
        { align: 'center', width: 500 }
      );

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating invoice');
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

