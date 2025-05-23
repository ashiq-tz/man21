const mongoose = require("mongoose");
const {Schema} = mongoose;
const crypto = require("crypto");

function genReferralCode() {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
}  

const userSchema = new Schema({
    name : {
        type : String,
        required : true
    },
    email: {
        type : String,
        required : true,
        unique : true
    },
    phone: {
        type : String,
        required : false,
        unique : false,
        sparse : true,
        default : null
    },
    googleId: {
        type : String,
        unique : true,
        // sparse: true
    },
    password: {
        type : String,
        required : false
    },
    isBlocked: {
        type : Boolean,
        default : false
    },
    isAdmin: {
        type : Boolean,
        default : false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref : "Cart"
    }],
    wallet: {
        type : Number,
        default : 0
    },
    walletHistory: [{
        date: {
            type: Date,
            default: Date.now
          },
          orderId: {
            type: String,
            default: null  
          },
          status: {
            type: String,
            required: true
          },
          type: {
            type: String,
            required: true,
            enum: ["credit", "debit"],
            default: "credit"
          },
          amount: {
            type: Number,
            required: true
          }
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref : "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdAt: {
        type : Date,
        default : Date.now
    },
    referralCode: {
        type: String,
        unique: true,
        default: genReferralCode
    },
    referralEarnings: {
        type: Number,
        default: 0
    },
      // optional: count & list of who they referred
    referralsCount: {
        type: Number,
        default: 0
    },
    referredUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
     }],


    redeemed: {
        type : Boolean
    },
    redeemedUsers: [{
        type : Schema.Types.ObjectId,
        ref : "User"
    }],
    searchHistory: [{
        category: {
            type : Schema.Types.ObjectId,
            ref : "Category"
        },
        brand : {
            type : String
        },
        searchOn : {
            type : Date,
            default : Date.now
        }
    }]
})


const User = mongoose.model("User",userSchema);

module.exports = User;
