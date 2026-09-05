const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    companyName: String,
    industry: String
}, {
    timestamps: true
});

module.exports = mongoose.model("Customer", CustomerSchema);