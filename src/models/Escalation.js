const mongoose = require("mongoose");

const EscalationSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    reason: String,

    priority: String,

    assignedTo: String,

    contextSummary: String,

    status: {
        type: String,
        default: "pending"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Escalation", EscalationSchema);