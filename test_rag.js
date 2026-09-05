require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const connectDB = require("./src/config/db");
const { retrieveKnowledge } = require("./src/services/rag.service");

async function runRAGTests() {
    await connectDB();

    const testQueries = [
        "What's the pricing for 200 users?",
        "How do you compare to CompetitorX?",
        "What features are included in the enterprise tier?"
    ];

    console.log("==================================================");
    console.log("       ECHOSPHERE RAG RETRIEVAL TEST SUITE        ");
    console.log("==================================================");

    for (const query of testQueries) {
        console.log(`\n🔍 QUERY: "${query}"`);
        const results = await retrieveKnowledge(query, { topK: 2 });
        if (results.length === 0) {
            console.log("❌ No chunks retrieved.");
        } else {
            results.forEach((r, idx) => {
                console.log(`  [Rank ${idx + 1}] Score: ${r.score} (Category: ${r.category.toUpperCase()})`);
                console.log(`  Source: ${r.documentTitle}`);
                console.log(`  Snippet: ${r.content.substring(0, 150).replace(/\n/g, " ")}...`);
            });
        }
    }
    console.log("\n==================================================");
    process.exit(0);
}

runRAGTests();
