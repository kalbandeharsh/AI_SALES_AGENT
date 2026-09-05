const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const { getAvailability, createMeeting, cancelMeeting } = require("../integrations/calendar/calendar");

// Get available calendar slots
router.get("/availability", async (req, res) => {
    try {
        const { date, durationMinutes } = req.query;
        const result = await getAvailability({ date, durationMinutes: Number(durationMinutes) || 30 });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all appointments/bookings
router.get("/", async (req, res) => {
    try {
        const bookings = await Appointment.find()
            .populate("customerId")
            .populate("conversationId")
            .sort({ startTime: -1 })
            .lean();
        res.json({ success: true, count: bookings.length, bookings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create calendar booking
router.post("/", async (req, res) => {
    try {
        const result = await createMeeting(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel appointment
router.delete("/:id", async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await cancelMeeting(req.params.id, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
