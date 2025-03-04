const mongoose = require("mongoose");
const {Schema} = mongoose;

const addressSchema = new Schema({
    userId: {
        type : Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    address: [{
        addressType:{
            type : String,
            required: true
        },
        name:{
            type: String,
            required: true
        },
        phone:{
            type: Number,
            required: true
        },
        houseNo:{
            type: String,
            
        },
        pincode:{
            type: Number,
            required: true
        },
        city:{
            type: String,
            required: true
        },
        street:{
            type: String,
            required: true
        },
        landmark:{
            type: String,
            required: true
        },
        state:{
            type: String,
            required: true
        },
        country:{
            type: String,
            required: true
        }

    }]
})

const Address = mongoose.model("Address",addressSchema);

module.exports = Address;