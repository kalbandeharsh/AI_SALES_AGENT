const express = require("express");
const cors = require("cors");

const app = express();

// Essential Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import API Routes
const customerRoutes = require("./routes/customer.routes");
const ragRoutes = require("./routes/rag.routes");
const leadRoutes = require("./routes/lead.routes");
const bookingRoutes = require("./routes/booking.routes");
const escalationRoutes = require("./routes/escalation.routes");
const conversationRoutes = require("./routes/conversation.routes");
const catalogRoutes = require("./routes/catalog.routes");
const agoraRoutes = require("./routes/agora.routes");

// Mount API Endpoints
app.use("/api/customers", customerRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/escalations", escalationRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/agora", agoraRoutes);

// Base Health & System Status
app.get("/", (req, res) => {
    res.json({
        name: "VantageVoice - Voice AI Sales Agent API",
        status: "online",
        stack: "MERN (MongoDB, Express, React, Node.js) + LangGraph + Agora Conversational AI",
        features: [
            "Agora Conversational AI RTC Engine",
            "LangGraph Reasoning & Multi-Turn State Memory",
            "Deterministic RAG Grounding (Zero Hallucination)",
            "Continuous BANT Lead Qualification",
            "Goal-Driven Outcomes (Meeting Booked, Lead Qualified, Follow-up)",
            "Low-Latency Interruption Handling (<80ms cutoff)",
            "Google Calendar Scheduling with Meet Links",
            "Slack Escalation Webhook Cards"
        ],
        endpoints: [
            "/api/agora/token",
            "/api/agora/webhook",
            "/api/rag/query",
            "/api/rag/chunks",
            "/api/leads",
            "/api/leads/score",
            "/api/bookings",
            "/api/bookings/availability",
            "/api/escalations",
            "/api/conversations/message",
            "/api/catalog/pricing"
        ]
    });
});

module.exports = app;