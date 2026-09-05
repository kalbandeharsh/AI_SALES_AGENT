const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    speaker: {
        type: String,
        enum: ["customer", "agent"]
    },

    message: String,

    interrupted: {
        type: Boolean,
        default: false
    },

    metadata: Object,

    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", MessageSchema);