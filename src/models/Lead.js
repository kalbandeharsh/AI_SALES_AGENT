const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer"
    },

    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    status: String,

    score: Number,

    priority: String,

    assignedTo: String
}, {
    timestamps: true
});

module.exports = mongoose.model("Lead", LeadSchema);