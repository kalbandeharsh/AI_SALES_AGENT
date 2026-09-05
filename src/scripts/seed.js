require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { ensureIndexes } = require("../config/db");
const KnowledgeChunk = require("../models/KnowledgeChunk");
const Product = require("../models/Product");
const Pricing = require("../models/Pricing");
const { chunkMarkdown } = require("../services/rag.service");

async function seedDatabase() {
    console.log("🚀 Starting EchoSphere Knowledge Base & Catalog Seeder...");

    try {
        await connectDB();
        await ensureIndexes();

        const kbDir = path.join(__dirname, "..", "..", "knowledge_base");
        const documentsToSeed = [
            {
                filename: "pricing.md",
                title: "EchoSphere Sales AI - Pricing Guide",
                category: "pricing"
            },
            {
                filename: "product_features.md",
                title: "EchoSphere Sales AI - Product Features",
                category: "features"
            },
            {
                filename: "competitor_comparison.md",
                title: "EchoSphere Sales AI - Competitor Comparison Battlecard",
                category: "competitor"
            }
        ];

        // 1. Ingest & Chunk Knowledge Base
        console.log("\n📚 Processing Knowledge Base Documents...");
        const allChunks = [];

        for (const doc of documentsToSeed) {
            const filePath = path.join(kbDir, doc.filename);
            if (!fs.existsSync(filePath)) {
                console.warn(`File not found: ${filePath}`);
                continue;
            }

            const rawContent = fs.readFileSync(filePath, "utf-8");
            const chunks = chunkMarkdown(doc.title, doc.category, rawContent);
            console.log(`  - [${doc.category.toUpperCase()}] "${doc.filename}": Generated ${chunks.length} chunks`);
            allChunks.push(...chunks);
        }

        // Wipe and recreate chunks
        await KnowledgeChunk.deleteMany({});
        const insertedChunks = await KnowledgeChunk.insertMany(allChunks);
        console.log(`✅ Successfully seeded ${insertedChunks.length} knowledge chunks to MongoDB!`);

        // 2. Seed Product & Pricing Catalog
        console.log("\n💼 Seeding EchoSphere Product & Pricing Catalog...");
        await Product.deleteMany({});
        await Pricing.deleteMany({});

        const product = await Product.create({
            name: "EchoSphere Voice AI Sales Agent",
            description: "Autonomous voice AI SDR that qualifies leads, handles objections, books meetings, and escalates to human sales teams.",
            category: "Sales Automation",
            features: [
                "Sub-450ms Voice Latency",
                "Natural Interruption Handling",
                "Deterministic RAG Grounding",
                "BANT Lead Scoring",
                "Autonomous Google Calendar Booking",
                "Slack Escalation Webhooks",
                "Full CRM Bi-directional Sync"
            ],
            active: true
        });

        const pricingTiers = [
            {
                productId: product._id,
                planName: "Starter Tier",
                billingCycle: "monthly",
                price: 29,
                currency: "USD",
                minUsers: 1,
                maxUsers: 9,
                active: true
            },
            {
                productId: product._id,
                planName: "Starter Tier (Annual)",
                billingCycle: "annual",
                price: 24,
                currency: "USD",
                minUsers: 1,
                maxUsers: 9,
                active: true
            },
            {
                productId: product._id,
                planName: "Growth Tier",
                billingCycle: "monthly",
                price: 59,
                currency: "USD",
                minUsers: 10,
                maxUsers: 49,
                active: true
            },
            {
                productId: product._id,
                planName: "Growth Tier (Annual)",
                billingCycle: "annual",
                price: 49,
                currency: "USD",
                minUsers: 10,
                maxUsers: 49,
                active: true
            },
            {
                productId: product._id,
                planName: "Enterprise Tier",
                billingCycle: "monthly",
                price: 99,
                currency: "USD",
                minUsers: 50,
                maxUsers: 10000,
                active: true
            },
            {
                productId: product._id,
                planName: "Enterprise Tier (Annual)",
                billingCycle: "annual",
                price: 79,
                currency: "USD",
                minUsers: 50,
                maxUsers: 10000,
                active: true
            }
        ];

        await Pricing.insertMany(pricingTiers);
        console.log(`✅ Successfully seeded Product & ${pricingTiers.length} Pricing tiers.`);

        console.log("\n🎉 EchoSphere database seeding completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seeder encountered an error:", err);
        process.exit(1);
    }
}

if (require.main === module) {
    seedDatabase();
}

module.exports = seedDatabase;
