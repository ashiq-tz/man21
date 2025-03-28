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
        .populate("orderedItems.product")
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
          activePage: "orders"
        });
      }
    } catch (error) {
      console.error("Error in loadOrders:", error);
      res.redirect("/admin/pageerror");
    }
  };
  
  

// GET /admin/orders/view?orderId=...
// Show a single order's details, user info, etc.
const viewOrder = async (req, res) => {
  try {
    const { orderId } = req.query;

    // Find the order, optionally populate orderedItems.product if you want product details
    const order = await Order.findOne({ orderId })
      .populate("orderedItems.product")
      .lean();

    if (!order) {
      return res.redirect("/admin/pageerror");
    }

    // If you want user info, you might have stored user ID in order, or do a separate lookup
    // If you store user info in the order schema, you can do something like:
    // const userData = await User.findById(order.userId).lean();

    res.render("order-details", {
      order,
      // userData,
    });
  } catch (error) {
    console.error("Error in viewOrder:", error);
    res.redirect("/admin/pageerror");
  }
};


const updateOrderStatus = async (req, res) => {
    try {
      const { orderId, newStatus } = req.body;
      let updateFields = { status: newStatus };
  
      // For statuses "Cancelled", "Returned", or "Delivered", set all items to that status.
      if (["Cancelled", "Returned", "Delivered"].includes(newStatus)) {
        updateFields["orderedItems.$[].itemStatus"] = newStatus;
      } else {
        updateFields["orderedItems.$[].itemStatus"] = "Active";
      }
  
      await Order.updateOne({ orderId }, { $set: updateFields });
      res.redirect("/admin/orders");
    } catch (error) {
      console.error("Error in updateOrderStatus:", error);
      res.redirect("/admin/pageerror");
    }
  };

module.exports = {
  loadOrders,
  viewOrder,
  updateOrderStatus,
};
