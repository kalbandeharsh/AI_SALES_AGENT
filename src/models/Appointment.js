const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer"
    },

    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
    },

    title: String,

    startTime: Date,

    endTime: Date,

    meetingLink: String,

    status: String
});

module.exports = mongoose.model("Appointment", AppointmentSchema);