const mongoose = require("mongoose");

const RequirementSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    key: String,

    value: mongoose.Schema.Types.Mixed,

    confidence: Number,

    sourceMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Requirement", RequirementSchema);