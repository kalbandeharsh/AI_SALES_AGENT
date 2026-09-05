const express = require("express");
const router = express.Router();
const Lead = require("../models/Lead");
const { calculateLeadScore, logLead } = require("../services/qualification.service");

// List all leads
router.get("/", async (req, res) => {
    try {
        const leads = await Lead.find()
            .populate("customerId")
            .populate("conversationId")
            .sort({ updatedAt: -1 })
            .lean();
        res.json({ success: true, count: leads.length, leads });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Calculate BANT lead score
router.post("/score", (req, res) => {
    try {
        const evaluation = calculateLeadScore(req.body);
        res.json({ success: true, evaluation });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Log or upsert lead
router.post("/", async (req, res) => {
    try {
        const result = await logLead(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update lead status/priority
router.patch("/:id", async (req, res) => {
    try {
        const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, lead });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
