const mongoose = require("mongoose");

const ObjectionSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    type: String,

    text: String,

    severity: String,

    resolved: {
        type: Boolean,
        default: false
    },

    response: String
}, {
    timestamps: true
});

module.exports = mongoose.model("Objection", ObjectionSchema);