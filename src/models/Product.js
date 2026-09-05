const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    description: String,

    category: String,

    features: [String],

    active: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model("Product", ProductSchema);