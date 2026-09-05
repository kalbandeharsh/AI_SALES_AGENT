const express = require("express");
const router = express.Router();
const { retrieveKnowledge } = require("../services/rag.service");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const seedDatabase = require("../scripts/seed");

// Query RAG knowledge base
router.post("/query", async (req, res) => {
    try {
        const { query, topK = 4, category = null } = req.body;
        if (!query) {
            return res.status(400).json({ error: "query string is required" });
        }
        const chunks = await retrieveKnowledge(query, { topK, category });
        res.json({
            success: true,
            query,
            count: chunks.length,
            results: chunks
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List all knowledge chunks
router.get("/chunks", async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category ? { category } : {};
        const chunks = await KnowledgeChunk.find(filter)
            .select("-embedding")
            .sort({ category: 1, chunkIndex: 1 })
            .lean();
        res.json({ success: true, count: chunks.length, chunks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger knowledge base re-seed
router.post("/seed", async (req, res) => {
    try {
        await seedDatabase();
        res.json({ success: true, message: "Database reseeded successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
