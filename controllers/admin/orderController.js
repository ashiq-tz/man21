const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");


const loadOrders = async (req, res) => {
    try {
      let search = req.query.search || "";
      let page = parseInt(req.query.page) || 1;
      const limit = 5;
      let query = {};
  
    
      if (search) {
        query["address.name"] = { $regex: ".*" + search + ".*", $options: "i" };
      }
  
      // Filter by order status
      if(req.query.filter) {
        query.status = req.query.filter;
      }
  
      // Sort options
      let sortObj = { createdAt: -1 };
      if(req.query.sort) {
        if(req.query.sort === "date_asc") {
          sortObj = { createdAt: 1 };
        } else if(req.query.sort === "amount_desc") {
          sortObj = { finalAmount: -1 };
        } else if(req.query.sort === "amount_asc") {
          sortObj = { finalAmount: 1 };
        }
      }
  
      const orders = await Order.find(query)
        .sort(sortObj)
        .limit(limit)
        .skip((page - 1) * limit)
        .populate("product")
        .lean();
  
      const count = await Order.countDocuments(query);
  
      // If AJAX request, return JSON
      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.json({
          orders,
          currentPage: page,
          totalPages: Math.ceil(count / limit)
        });
      } else {
        res.render("orders", {
          orders,
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          search,
          filter: req.query.filter || "",
          sort: req.query.sort   || "" ,
          activePage: "orders"
        });
      }
    } catch (error) {
      console.error("Error in loadOrders:", error);
      res.redirect("/admin/pageerror");
    }
  };

const orderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    // Find the order
    const order = await Order.findOne({ orderId })
      .populate('product')
      .populate('address');
    if (!order) {
      return res.redirect('/admin/pageerror');
    }
    res.render("order-details-admin", { order });
  } catch (error) {
    console.error("Error in orderDetails:", error);
    res.redirect('/admin/pageerror');
  }
};


const updateOrderDetailsStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newStatus } = req.body;
    
    //order
    const order = await Order.findOne({ orderId }).populate('product');
    if (!order) {
      return res.redirect('/admin/pageerror');
    }

    const previousStatus = order.status;
    
    const activeStatuses = ["Pending", "Processing", "Shipped", "Delivered"];
    const product = order.product;

    const variant = product.variants.find(v => v.size.toString() === order.size.toString());
    
    if (previousStatus === "Return Requested") {
      // If the admin accepts the return:
      if (newStatus === "Returned") {
        // When a return is accepted, restore the stock.
        if (variant) {
          variant.stock += order.quantity;
          await product.save();
        }
      }
    
    } else {
      // For all other transitions
      if (activeStatuses.includes(previousStatus) && (newStatus === "Cancelled" || newStatus === "Returned")) {
        if (variant) {
          variant.stock += order.quantity;
          await product.save();
        }
      } else if ((previousStatus === "Cancelled" || previousStatus === "Returned") && activeStatuses.includes(newStatus)) {
        if (variant && variant.stock >= order.quantity) {
          variant.stock -= order.quantity;
          await product.save();
        } else {
          return res.json({ success: false, message: "Insufficient stock to reactivate the order" });
        }
      }
    }
    
    order.status = newStatus;
   
    await order.save();
    
    res.redirect("/admin/orders");
  } catch (error) {
    console.error("Error in updateOrderDetailsStatus:", error);
    res.redirect('/admin/pageerror');
  }
};




module.exports = {
  loadOrders,
  orderDetails,
  updateOrderDetailsStatus,
};

