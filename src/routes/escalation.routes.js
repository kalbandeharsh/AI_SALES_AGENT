const express = require("express");
const router = express.Router();
const Escalation = require("../models/Escalation");
const { sendSlackEscalation } = require("../services/escalation.service");

// List all escalations
router.get("/", async (req, res) => {
    try {
        const escalations = await Escalation.find()
            .populate("conversationId")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, count: escalations.length, escalations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger an escalation and send Slack webhook alert
router.post("/", async (req, res) => {
    try {
        const result = await sendSlackEscalation(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Resolve escalation
router.patch("/:id/resolve", async (req, res) => {
    try {
        const escalation = await Escalation.findByIdAndUpdate(
            req.params.id,
            { status: "resolved" },
            { new: true }
        );
        res.json({ success: true, escalation });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
