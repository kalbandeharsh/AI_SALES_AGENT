const express = require("express");
const router = express.Router();
const { generateRtcToken, handleAgoraWebhook } = require("../integrations/agora/agora.service");

// Generate RTC token for joining Agora voice channel
router.post("/token", (req, res) => {
    try {
        const { channelName = "vantagevoice-room-1", uid = 0, role = "publisher" } = req.body;
        const tokenData = generateRtcToken(channelName, uid, role);
        res.json({ success: true, ...tokenData });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agora Conversational AI Webhook endpoint
router.post("/webhook", async (req, res) => {
    try {
        const result = await handleAgoraWebhook(req.body);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
