const mongoose = require("mongoose");

const CRMActionSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    actionType: String,

    payload: Object,

    status: String,

    externalId: String
}, {
    timestamps: true
});

module.exports = mongoose.model("CRMAction", CRMActionSchema);