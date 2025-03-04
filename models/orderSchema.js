const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: ()=>uuidv4(),
        unique: true
    },
    orderedItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            required:true
        }
    }],
    totalPrice:{
        type:Number,
        requird:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        requird:true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        requird:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Returned']
    },
    createdAt:{
        type:Date,
        default:Date.now,
        requird:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    }
})


const Order = mongoose.model("Order",orderSchema);

module.exports = Order;