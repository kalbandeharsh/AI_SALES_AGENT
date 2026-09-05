const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer"
    },

    status: {
        type: String,
        enum: ["active", "completed", "escalated"],
        default: "active"
    },

    currentStage: String,

    intent: String,

    summary: String,

    qualificationScore: {
        type: Number,
        default: 0
    },

    startedAt: {
        type: Date,
        default: Date.now
    },

    endedAt: Date
});

module.exports = mongoose.model("Conversation", ConversationSchema);