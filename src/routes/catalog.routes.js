const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Pricing = require("../models/Pricing");
const tools = require("../ai/tools");

router.get("/products", async (req, res) => {
    try {
        const products = await Product.find().lean();
        res.json({ success: true, products });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get("/pricing", async (req, res) => {
    try {
        const pricing = await Pricing.find().populate("productId").lean();
        res.json({ success: true, pricing });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/pricing/calculate", async (req, res) => {
    try {
        const quote = await tools.getProductPricing(req.body);
        res.json({ success: true, quote });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
