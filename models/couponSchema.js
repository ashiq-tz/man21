const mongoose = require("mongoose");
const {Schema} = mongoose;

const couponSchema = new mongoose.Schema({
    name: {
        type: String,
        required:true,
        unique:true,
        uppercase: true,
        trim: true

    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    expireOn:{
        type:Date,
        required:true
    },
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    isDeleted:{
        type:Boolean,
        default:false
    },
    usedBy:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
})


const Coupon = mongoose.model("Coupon",couponSchema);

module.exports = Coupon;