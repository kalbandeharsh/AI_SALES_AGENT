const mongoose = require("mongoose");

const KnowledgeChunkSchema = new mongoose.Schema({
    documentTitle: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ["pricing", "features", "competitor", "general"],
        default: "general",
        index: true
    },
    chunkIndex: {
        type: Number,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    tags: [{
        type: String,
        index: true
    }],
    embedding: {
        type: [Number],
        default: []
    },
    tokenCount: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Full-text search index for keyword retrieval boosting
KnowledgeChunkSchema.index({
    content: "text",
    documentTitle: "text",
    tags: "text"
});

KnowledgeChunkSchema.index({ category: 1, chunkIndex: 1 });

module.exports = mongoose.model("KnowledgeChunk", KnowledgeChunkSchema);
