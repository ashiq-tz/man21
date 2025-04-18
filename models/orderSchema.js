// models/orderSchema.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const orderSchema = new Schema({
  orderId: { 
    type: String, 
    default: () => uuidv4(), 
    unique: true 
  },
  // Group Order Id used to track all orders
  groupOrderId: {
    type: String
  },
  // Instead of an array, store the product details directly.
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {  // include variant information 
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  address: {
    type: Object,
    required: true
  },
  invoiceDate: {
    type: Date
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Requested', 'Return Rejected']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  couponApplied: {
    type: Boolean,
    default: false
  },
  paymentMethod: {           
    type: String,
    required: false
  },
  returnReason: {
    type: String,
    default: ""
  }

});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
