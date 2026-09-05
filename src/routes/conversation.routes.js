const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const ConversationEvent = require("../models/ConversationEvent");
const { processAgentTurn } = require("../services/agent.service");

// Process conversational turn with RAG & tool execution
router.post("/message", async (req, res) => {
    try {
        const { conversationId, userMessage, customerId } = req.body;
        if (!userMessage) {
            return res.status(400).json({ error: "userMessage is required" });
        }
        const result = await processAgentTurn({ conversationId, userMessage, customerId });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List recent conversations
router.get("/", async (req, res) => {
    try {
        const conversations = await Conversation.find()
            .populate("customerId")
            .sort({ startedAt: -1 })
            .limit(20)
            .lean();
        res.json({ success: true, count: conversations.length, conversations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get conversation messages
router.get("/:id/messages", async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.id })
            .sort({ timestamp: 1 })
            .lean();
        res.json({ success: true, count: messages.length, messages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register interruption event
router.post("/:id/interrupt", async (req, res) => {
    try {
        const { id } = req.params;
        // Mark the last agent message as interrupted
        const lastAgentMsg = await Message.findOneAndUpdate(
            { conversationId: id, speaker: "agent" },
            { interrupted: true },
            { sort: { timestamp: -1 }, new: true }
        );

        await ConversationEvent.create({
            conversationId: id,
            eventType: "interruption",
            data: { interruptedMessageId: lastAgentMsg ? lastAgentMsg._id : null }
        });

        res.json({ success: true, message: "Interruption recorded", lastAgentMsg });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
