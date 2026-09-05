const mongoose = require("mongoose");

const ConversationEventSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    eventType: String,

    data: Object,

    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model(
    "ConversationEvent",
    ConversationEventSchema
);