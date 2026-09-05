const { retrieveKnowledge } = require("../services/rag.service");
const { getAvailability, createMeeting, cancelMeeting } = require("../integrations/calendar/calendar");
const { calculateLeadScore, logLead } = require("../services/qualification.service");
const { sendSlackEscalation } = require("../services/escalation.service");
const Pricing = require("../models/Pricing");
const Requirement = require("../models/Requirement");
const Lead = require("../models/Lead");
const CRMAction = require("../models/CRMAction");

/**
 * Tool 1: Get factual product information using deterministic RAG
 */
async function getProductInformation(query) {
    const chunks = await retrieveKnowledge(query, { topK: 3 });
    return {
        query,
        chunksFound: chunks.length,
        groundedFacts: chunks.map(c => ({
            source: c.documentTitle,
            category: c.category,
            snippet: c.content,
            relevanceScore: c.score
        }))
    };
}

/**
 * Tool 2: Calculate deterministic product pricing with volume and billing discounts
 */
async function getProductPricing(params = {}) {
    const { userCount = 1, tier = "growth", billingCycle = "monthly" } = params;
    const count = Math.max(1, parseInt(userCount, 10));

    // Determine base rate per tier
    let basePricePerUser = 59; // default growth
    const lowerTier = tier.toLowerCase();
    if (lowerTier.includes("starter")) {
        basePricePerUser = 29;
    } else if (lowerTier.includes("enterprise") || count >= 50) {
        basePricePerUser = 99;
    }

    // Tiered Volume Discounts
    let volumeDiscountPct = 0;
    if (count >= 200) {
        volumeDiscountPct = 0.25; // 25% off for 200+
    } else if (count >= 50) {
        volumeDiscountPct = 0.15; // 15% off for 50-199
    } else if (count >= 10) {
        volumeDiscountPct = 0.10; // 10% off for 10-49
    }

    // Annual billing discount (20% off)
    const isAnnual = billingCycle.toLowerCase().includes("annual") || billingCycle.toLowerCase().includes("year");
    const annualDiscountPct = isAnnual ? 0.20 : 0.0;

    const priceAfterVolume = basePricePerUser * (1 - volumeDiscountPct);
    const effectivePerUserMonthly = priceAfterVolume * (1 - annualDiscountPct);
    const monthlyTotal = Math.round(effectivePerUserMonthly * count * 100) / 100;
    const annualTotal = Math.round(monthlyTotal * 12 * 100) / 100;

    // RAG cross-check
    const ragContext = await retrieveKnowledge(`pricing for ${count} users`, { topK: 1, category: "pricing" });

    return {
        userCount: count,
        recommendedTier: count >= 50 ? "Enterprise" : count >= 10 ? "Growth" : "Starter",
        billingCycle: isAnnual ? "annual" : "monthly",
        baseListPricePerUser: basePricePerUser,
        volumeDiscountApplied: `${volumeDiscountPct * 100}%`,
        annualDiscountApplied: `${annualDiscountPct * 100}%`,
        effectivePerUserMonthly: Math.round(effectivePerUserMonthly * 100) / 100,
        monthlyTotal,
        annualTotal,
        notes: count >= 200 ? "Qualifies for waived $5,000 onboarding & dedicated TAM." : "Standard onboarding included.",
        ragGrounding: ragContext.length > 0 ? ragContext[0].content : null
    };
}

/**
 * Tool 3: Get all extracted requirements for a conversation
 */
async function getCustomerRequirements(conversationId) {
    try {
        const requirements = await Requirement.find({ conversationId }).lean();
        return { success: true, count: requirements.length, requirements };
    } catch (err) {
        return { success: false, error: err.message, requirements: [] };
    }
}

/**
 * Tool 4: Upsert an extracted requirement during conversational turn
 */
async function updateCustomerRequirement(conversationId, requirementData) {
    const { key, value, confidence = 0.9, sourceMessageId } = requirementData;
    try {
        const requirement = await Requirement.findOneAndUpdate(
            { conversationId, key },
            {
                conversationId,
                key,
                value,
                confidence,
                sourceMessageId,
                updatedAt: new Date()
            },
            { new: true, upsert: true }
        );
        return { success: true, requirement };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Tool 5: Check general availability
 */
async function checkAvailability(date) {
    return await getAvailability({ date });
}

/**
 * Tool 6: Check calendar availability (Step 6)
 */
async function checkCalendarAvailability(date) {
    return await getAvailability({ date });
}

/**
 * Tool 7: Calculate BANT Lead Score (Step 7)
 */
function calculateLeadScoreTool(metrics) {
    return calculateLeadScore(metrics);
}

/**
 * Tool 8: Create / Log Lead in MongoDB (Step 7)
 */
async function createLead(leadData) {
    return await logLead(leadData);
}

/**
 * Tool 9: Update existing lead
 */
async function updateLead(leadId, updates) {
    try {
        const lead = await Lead.findByIdAndUpdate(leadId, updates, { new: true });
        return { success: true, lead };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Tool 10: Book Google Calendar Meeting (Step 6)
 */
async function bookMeeting(bookingData) {
    return await createMeeting(bookingData);
}

/**
 * Tool 11: Create follow-up CRM task
 */
async function createFollowup(followupData) {
    const { conversationId, date, notes = "Follow up required" } = followupData;
    try {
        const action = await CRMAction.create({
            conversationId,
            actionType: "followup_scheduled",
            payload: { scheduledDate: date, notes },
            status: "pending"
        });
        return { success: true, followup: action };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Tool 12: Escalate conversation to human agent with Slack webhook (Step 8)
 */
async function escalateToHuman(escalationData) {
    return await sendSlackEscalation(escalationData);
}

const tools = {
    getProductInformation,
    getProductPricing,
    getCustomerRequirements,
    updateCustomerRequirement,
    checkAvailability,
    calculateLeadScore: calculateLeadScoreTool,
    createLead,
    updateLead,
    checkCalendarAvailability,
    bookMeeting,
    createFollowup,
    escalateToHuman
};

module.exports = tools;