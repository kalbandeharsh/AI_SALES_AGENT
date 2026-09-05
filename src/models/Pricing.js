const mongoose = require("mongoose");

const PricingSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    planName: String,

    billingCycle: String,

    price: Number,

    currency: {
        type: String,
        default: "INR"
    },

    minUsers: Number,

    maxUsers: Number,

    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("Pricing", PricingSchema);