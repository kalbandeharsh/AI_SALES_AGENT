const mongoose = require("mongoose");
const dns = require("dns");

// Ensure proper DNS resolution for MongoDB Atlas SRV connection strings on Windows
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
    console.warn("DNS custom servers not applied:", e.message);
}

const ensureIndexes = async () => {
    try {
        console.log("Ensuring database indexes for EchoSphere collections...");
        const Lead = require("../models/Lead");
        const Appointment = require("../models/Appointment");
        const Escalation = require("../models/Escalation");
        const Conversation = require("../models/Conversation");
        const KnowledgeChunk = require("../models/KnowledgeChunk");

        await Promise.all([
            Lead.syncIndexes(),
            Appointment.syncIndexes(),
            Escalation.syncIndexes(),
            Conversation.syncIndexes(),
            KnowledgeChunk.syncIndexes()
        ]);
        console.log("✅ EchoSphere indexes synchronized successfully.");
    } catch (error) {
        console.warn("Index synchronization warning:", error.message);
    }
};

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/sales_ai";
        await mongoose.connect(uri);
        console.log("MongoDB connected successfully to:", uri.includes("@") ? uri.split("@")[1] : uri);
        await ensureIndexes();
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        // Don't exit process in test environments, allow reconnection or graceful error handling
        if (process.env.NODE_ENV === "production") {
            process.exit(1);
        }
    }
};

module.exports = connectDB;
module.exports.ensureIndexes = ensureIndexes;