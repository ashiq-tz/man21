
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");

const PDFDocument = require('pdfkit');

// Place Order
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod, couponCode } = req.body;

    // 1) Find the cart and populate products
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty." });
    }

    // 2) Find the address
    const userAddressDoc = await Address.findOne({ userId });
    if (!userAddressDoc) {
      return res.json({ success: false, message: "No addresses found. Please add an address." });
    }
    // Select the address by id
    const selectedAddress = userAddressDoc.address.find((a) => a._id.toString() === addressId);
    if (!selectedAddress) {
      return res.json({ success: false, message: "Selected address not found." });
    }

    // 3) Build the orderedItems array and decrement stock
    let orderedItems = [];
    let totalPrice = 0;

    for (const item of cart.items) {
      const product = item.productId;
      const quantity = item.quantity;
      const price = product.salePrice;
      const itemTotal = price * quantity;
      totalPrice += itemTotal;

      // Decrement stock for the product variant (use == to handle type differences)
      const variantIndex = product.variants.findIndex(v => v.size == item.size);
      if (variantIndex > -1) {
        product.variants[variantIndex].stock -= quantity;
        console.log(`Decremented stock for product ${product._id} (size ${item.size}). New stock: ${product.variants[variantIndex].stock}`);
        await product.save();
      } else {
        console.log(`Variant with size ${item.size} not found for product ${product._id}`);
      }

      orderedItems.push({
        product: product._id,
        quantity,
        price,
        itemStatus: "Active" // set new item as Active
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
      address: userAddressDoc.userId, // or store the entire selectedAddress if preferred
      status: "Pending",
      createdAt: Date.now(),
      couponApplied: couponCode ? true : false,
    });
    await newOrder.save();
    // console.log(`Order ${newOrder.orderId} created successfully.`);

    // 6) Push the order to the user's orderHistory
    await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });

    // 7) Clear the cart after ordering
    cart.items = [];
    await cart.save();
    

    // 8) Return success with the new orderId
    return res.json({ success: true, orderId: newOrder.orderId });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    return res.json({ success: false, message: "An error occurred. Please try again." });
  }
};

const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId); 
    const orderId = req.query.orderId;
    res.render("order-success", { orderId,user });
  } catch (error) {
    console.error("Error in orderSuccess:", error);
    res.redirect("/pageNotFound");
  }
};

// Cancel Order
const cancelOrder = async (req, res) => {
  try {
    const { orderId, productsToCancel } = req.body;
    
    // Find the order
    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.log("Order not found:", orderId);
      return res.json({ success: false, message: "Order not found" });
    }

    // If productsToCancel is present, do partial cancellation
    if (productsToCancel && productsToCancel.length > 0) {
      console.log("Processing partial cancellation...");

      for (const cancelItem of productsToCancel) {
        // Find the matching item
        const orderItemIndex = order.orderedItems.findIndex(item =>
          item.product._id.toString() === cancelItem.productId &&
          (cancelItem.size
            ? (item.size && item.size.toString() === cancelItem.size.toString())
            : true)
        );
        if (orderItemIndex > -1) {
          const orderItem = order.orderedItems[orderItemIndex];
          // console.log(`Found item for cancellation: Product ${cancelItem.productId}, quantity: ${orderItem.quantity}`);

          // Restore stock
          const product = await Product.findById(cancelItem.productId);
          if (product) {
            const variant = product.variants.find(v =>
              cancelItem.size ? v.size.toString() === cancelItem.size.toString() : true
            );
            if (variant) {
              const qtyToRestore = Math.min(cancelItem.quantity, orderItem.quantity);
              variant.stock += qtyToRestore;
              console.log(`Restored stock for product ${cancelItem.productId}: new stock ${variant.stock}`);
            }
            await product.save();
          }

          // Update order item status or quantity
          if (cancelItem.quantity >= orderItem.quantity) {
            orderItem.itemStatus = "Cancelled";
            console.log(`Item fully cancelled for product ${cancelItem.productId}`);
          } else {
            orderItem.quantity -= cancelItem.quantity;
            // console.log(`Item partially cancelled for product ${cancelItem.productId}: new quantity ${orderItem.quantity}`);
          }
        }
      }

      // If all items are now cancelled, set order status
      const allCancelled = order.orderedItems.every(item => item.itemStatus === "Cancelled");
      if (allCancelled) {
        order.status = "Cancelled";
      }

    } else {
      // Full order cancellation
      console.log("Processing full order cancellation...");

      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const variant = product.variants.find(v =>
            item.size ? v.size.toString() === item.size.toString() : true
          );
          if (variant) {
            variant.stock += item.quantity;
          }
          await product.save();
        }
        item.itemStatus = "Cancelled";
      }
      order.status = "Cancelled";
    }

    await order.save();
    console.log("Order cancellation processed:", order.orderId);
    return res.json({ success: true, message: "Order cancellation processed." });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.json({ success: false, message: "An error occurred while cancelling the order." });
  }
};


// Return Order
const returnOrder = async (req, res) => {
  try {
    const { orderId, returnReason, productsToReturn } = req.body;
    console.log("Return order request received:", { orderId, returnReason, productsToReturn });

    const order = await Order.findOne({ orderId }).populate('orderedItems.product');
    if (!order) {
      console.log("Order not found:", orderId);
      return res.json({ success: false, message: "Order not found" });
    }
    
    if (order.status !== "Delivered") {
      console.log("Order is not delivered:", order.status);
      return res.json({ success: false, message: "Only delivered orders can be returned." });
    }
    
    // Partial return branch: if productsToReturn is provided
    if (productsToReturn && productsToReturn.length > 0) {
      console.log("Processing partial return...");
      for (const returnItem of productsToReturn) {
        const orderItemIndex = order.orderedItems.findIndex(item =>
          item.product._id.toString() === returnItem.productId &&
          (returnItem.size ? (item.size && item.size.toString() === returnItem.size.toString()) : true)
        );
        if (orderItemIndex > -1) {
          const orderItem = order.orderedItems[orderItemIndex];
          console.log(`Found item for return: Product ${returnItem.productId}, Current quantity: ${orderItem.quantity}`);

          // Restore stock for the returned quantity
          const product = await Product.findById(returnItem.productId);
          if (product) {
            const variant = product.variants.find(v =>
              returnItem.size ? v.size.toString() === returnItem.size.toString() : true
            );
            if (variant) {
              const qtyToRestore = Math.min(returnItem.quantity, orderItem.quantity);
              variant.stock += qtyToRestore;
              console.log(`Restored stock for product ${returnItem.productId}: New stock ${variant.stock}`);
            }
            await product.save();
          }

          // Update order item based on return quantity
          if (returnItem.quantity >= orderItem.quantity) {
            orderItem.itemStatus = "Returned";
            console.log(`Item fully returned for product ${returnItem.productId}`);
          } else {
            orderItem.quantity -= returnItem.quantity;
            console.log(`Item partially returned for product ${returnItem.productId}: New quantity ${orderItem.quantity}`);
          }
        } else {
          console.log(`No matching item found for return: Product ${returnItem.productId}`);
        }
      }
      if (returnReason) {
        order.returnReason = returnReason;
        console.log("Return reason stored:", returnReason);
      }
    } else {
      // Full order return branch
      console.log("Processing full order return...");
      for (const item of order.orderedItems) {
        const product = await Product.findById(item.product);
        if (product) {
          const variant = product.variants.find(v =>
            item.size ? v.size.toString() === item.size.toString() : true
          );
          if (variant) {
            variant.stock += item.quantity;
          }
          await product.save();
        }
        item.itemStatus = "Returned";
      }
      order.status = "Returned";
      if (returnReason) {
        order.returnReason = returnReason;
      }
    }
    
    await order.save();
    console.log("Order return processed:", order.orderId);
    return res.json({ success: true, message: "Return processed successfully." });
  } catch (error) {
    console.error("Error processing return:", error);
    return res.json({ success: false, message: "An error occurred while processing the return." });
  }
};

// Order Details: Render a detailed order view page
const orderDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId); 
    const { orderId } = req.query;
    // Populate orderedItems and address if needed
    const order = await Order.findOne({ orderId })
      .populate('orderedItems.product')
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
    // Find the order and populate the products in orderedItems
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
  cancelOrder,
  returnOrder,
  orderDetails,
  downloadInvoice
};
