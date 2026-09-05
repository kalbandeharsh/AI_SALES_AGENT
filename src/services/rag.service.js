const fs = require("fs");
const path = require("path");
const KnowledgeChunk = require("../models/KnowledgeChunk");

// Semantic Vector Dimensions for internal embedding representation
const VECTOR_DIMENSIONS = 128;

/**
 * Clean and tokenize text into normalized lemmas/tokens
 */
function tokenize(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
    "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
    "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
    "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
    "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
    "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
    "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
    "they've", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours"
]);

/**
 * Generates a normalized semantic feature embedding vector for text
 * Uses hashing vectorization + positional character/subword n-grams for semantic sensitivity
 */
function generateEmbedding(text) {
    const vector = new Array(VECTOR_DIMENSIONS).fill(0);
    const tokens = tokenize(text);

    if (tokens.length === 0) return vector;

    tokens.forEach((token, index) => {
        // Unigram hash
        const h1 = Math.abs(hashString(token)) % VECTOR_DIMENSIONS;
        vector[h1] += 1.0;

        // Subword 3-grams
        for (let i = 0; i <= token.length - 3; i++) {
            const sub = token.substring(i, i + 3);
            const hSub = Math.abs(hashString(sub)) % VECTOR_DIMENSIONS;
            vector[hSub] += 0.4;
        }

        // Bigram hash with next token
        if (index < tokens.length - 1) {
            const bigram = `${token}_${tokens[index + 1]}`;
            const h2 = Math.abs(hashString(bigram)) % VECTOR_DIMENSIONS;
            vector[h2] += 1.5;
        }
    });

    // Normalize to unit vector (L2 norm)
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
        for (let i = 0; i < VECTOR_DIMENSIONS; i++) {
            vector[i] /= norm;
        }
    }

    return vector;
}

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Cosine similarity between two unit vectors
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    let dot = 0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
        dot += vecA[i] * vecB[i];
    }
    return dot;
}

/**
 * Keyword match ratio (BM25 inspired token overlap)
 */
function keywordMatchScore(queryTokens, chunkText) {
    if (!queryTokens.length) return 0;
    const chunkTokens = new Set(tokenize(chunkText));
    let matches = 0;
    for (const q of queryTokens) {
        if (chunkTokens.has(q)) {
            matches++;
        } else {
            // Partial match for stems
            for (const c of chunkTokens) {
                if (c.includes(q) || q.includes(c)) {
                    matches += 0.5;
                    break;
                }
            }
        }
    }
    return matches / queryTokens.length;
}

/**
 * Break markdown content into logical, focused chunks
 */
function chunkMarkdown(documentTitle, category, rawMarkdown) {
    const lines = rawMarkdown.split("\n");
    const chunks = [];
    let currentHeader = documentTitle;
    let currentBuffer = [];

    const flushChunk = () => {
        const text = currentBuffer.join("\n").trim();
        if (text.length > 50) {
            const tags = Array.from(new Set(tokenize(`${currentHeader} ${category}`)));
            chunks.push({
                documentTitle,
                category,
                chunkIndex: chunks.length,
                content: `### ${currentHeader}\n${text}`,
                tags,
                tokenCount: text.split(/\s+/).length,
                embedding: generateEmbedding(`${currentHeader} ${text}`),
                metadata: {
                    source: `${category}.md`,
                    section: currentHeader
                }
            });
        }
        currentBuffer = [];
    };

    for (const line of lines) {
        // Split on H2 or H3 headers
        if (line.startsWith("## ") || line.startsWith("### ")) {
            if (currentBuffer.length > 0) {
                flushChunk();
            }
            currentHeader = line.replace(/^#+\s*/, "").trim();
        } else {
            currentBuffer.push(line);
        }
    }
    if (currentBuffer.length > 0) {
        flushChunk();
    }

    return chunks;
}

/**
 * Step 5: Retrieve the top K most relevant knowledge base chunks for a query
 * Combines semantic vector similarity and keyword overlap
 */
async function retrieveKnowledge(query, options = {}) {
    const { topK = 4, category = null, minScore = 0.15 } = options;

    if (!query || typeof query !== "string") {
        return [];
    }

    const queryVector = generateEmbedding(query);
    const queryTokens = tokenize(query);

    // Build filter
    const filter = {};
    if (category) {
        filter.category = category;
    }

    let chunks = [];
    try {
        chunks = await KnowledgeChunk.find(filter).lean();
    } catch (err) {
        console.warn("Could not query KnowledgeChunk from MongoDB:", err.message);
    }

    // If MongoDB has no chunks yet, attempt to read directly from files
    if (!chunks || chunks.length === 0) {
        chunks = getLocalFileChunks(category);
    }

    // Score every chunk with hybrid weighting: 65% Vector similarity + 35% Keyword match
    const scoredChunks = chunks.map(chunk => {
        const chunkEmbedding = chunk.embedding && chunk.embedding.length > 0
            ? chunk.embedding
            : generateEmbedding(chunk.content);

        const vectorScore = cosineSimilarity(queryVector, chunkEmbedding);
        const keywordScore = keywordMatchScore(queryTokens, chunk.content);

        // Boost if query matches specific intent keywords
        let boost = 0;
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes("price") || lowerQuery.includes("cost") || lowerQuery.includes("discount") || lowerQuery.includes("user")) {
            if (chunk.category === "pricing") boost += 0.15;
        }
        if (lowerQuery.includes("competitor") || lowerQuery.includes("compare") || lowerQuery.includes("vs") || lowerQuery.includes("bland") || lowerQuery.includes("retell")) {
            if (chunk.category === "competitor") boost += 0.2;
        }
        if (lowerQuery.includes("feature") || lowerQuery.includes("latency") || lowerQuery.includes("interruption") || lowerQuery.includes("tier")) {
            if (chunk.category === "features") boost += 0.15;
        }

        const compositeScore = (vectorScore * 0.65) + (keywordScore * 0.35) + boost;

        return {
            id: chunk._id || chunk.chunkIndex,
            documentTitle: chunk.documentTitle,
            category: chunk.category,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            score: Math.round(compositeScore * 1000) / 1000,
            vectorScore: Math.round(vectorScore * 1000) / 1000,
            keywordScore: Math.round(keywordScore * 1000) / 1000,
            metadata: chunk.metadata || {}
        };
    });

    // Sort descending by score
    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks
        .filter(c => c.score >= minScore)
        .slice(0, topK);
}

/**
 * Fallback to read from markdown files directly if database is not yet seeded
 */
function getLocalFileChunks(categoryFilter = null) {
    const kbDir = path.join(__dirname, "..", "..", "knowledge_base");
    const docs = [
        { file: "pricing.md", category: "pricing", title: "EchoSphere Sales AI - Pricing Guide" },
        { file: "product_features.md", category: "features", title: "EchoSphere Sales AI - Product Features" },
        { file: "competitor_comparison.md", category: "competitor", title: "EchoSphere Sales AI - Competitor Comparison Battlecard" }
    ];

    let allChunks = [];
    for (const doc of docs) {
        if (categoryFilter && doc.category !== categoryFilter) continue;
        const filePath = path.join(kbDir, doc.file);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const chunks = chunkMarkdown(doc.title, doc.category, content);
            allChunks.push(...chunks);
        }
    }
    return allChunks;
}

module.exports = {
    generateEmbedding,
    cosineSimilarity,
    chunkMarkdown,
    retrieveKnowledge,
    tokenize
};
