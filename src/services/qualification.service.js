const Lead = require("../models/Lead");
const Conversation = require("../models/Conversation");
const CRMAction = require("../models/CRMAction");
const Requirement = require("../models/Requirement");

/**
 * Step 7: BANT (Budget, Authority, Need, Timeline) Lead Scoring Engine
 * Outputs a 0-100 score and priority tier
 */
function calculateLeadScore(metrics = {}) {
    const {
        userCount = 1,
        budgetMonthly = 0,
        timeline = "medium", // 'immediate', 'short', 'medium', 'long'
        authorityRole = "influencer", // 'decision_maker', 'influencer', 'user'
        needIntensity = "medium", // 'critical', 'high', 'medium', 'low'
        objectionsCount = 0
    } = metrics;

    let score = 0;

    // 1. Budget & Scale (Max 30 pts)
    if (userCount >= 50 || budgetMonthly >= 4000) {
        score += 30;
    } else if (userCount >= 10 || budgetMonthly >= 1000) {
        score += 22;
    } else if (userCount >= 3 || budgetMonthly >= 300) {
        score += 15;
    } else {
        score += 8;
    }

    // 2. Decision Making Authority (Max 25 pts)
    const normalizedRole = String(authorityRole).toLowerCase();
    if (["cxo", "vp", "director", "owner", "founder", "head of sales", "cro", "decision_maker"].some(r => normalizedRole.includes(r))) {
        score += 25;
    } else if (["manager", "lead", "supervisor", "influencer"].some(r => normalizedRole.includes(r))) {
        score += 16;
    } else {
        score += 8;
    }

    // 3. Need & Urgency (Max 25 pts)
    const normalizedNeed = String(needIntensity).toLowerCase();
    if (normalizedNeed === "critical" || normalizedNeed === "high") {
        score += 25;
    } else if (normalizedNeed === "medium") {
        score += 18;
    } else {
        score += 10;
    }

    // 4. Timeline (Max 20 pts)
    const normalizedTimeline = String(timeline).toLowerCase();
    if (normalizedTimeline.includes("immediate") || normalizedTimeline.includes("this month") || normalizedTimeline === "short") {
        score += 20;
    } else if (normalizedTimeline.includes("quarter") || normalizedTimeline === "medium") {
        score += 14;
    } else {
        score += 6;
    }

    // Deduction for unresolved objections
    const objectionPenalty = Math.min(15, objectionsCount * 5);
    score = Math.max(0, Math.min(100, score - objectionPenalty));

    // Determine Priority
    let priority = "LOW";
    if (score >= 70) {
        priority = "HIGH";
    } else if (score >= 45) {
        priority = "MEDIUM";
    }

    return {
        score,
        priority,
        breakdown: {
            budgetPoints: userCount >= 50 ? 30 : userCount >= 10 ? 22 : 15,
            authorityRole,
            needIntensity,
            timeline,
            objectionsPenalty: objectionPenalty
        }
    };
}

/**
 * Step 7: Wire lead logging into MongoDB
 * Creates or updates a Lead document and links with CRM actions and Conversation
 */
async function logLead(leadPayload) {
    const {
        customerId,
        conversationId,
        qualificationSnapshot = {},
        status = "qualified",
        assignedTo = "Enterprise Sales Team"
    } = leadPayload;

    // Calculate score from snapshot
    const evaluation = calculateLeadScore(qualificationSnapshot);

    let lead;
    try {
        // Upsert lead for this customer/conversation
        lead = await Lead.findOneAndUpdate(
            { conversationId },
            {
                customerId,
                conversationId,
                status,
                score: evaluation.score,
                priority: evaluation.priority,
                assignedTo
            },
            { new: true, upsert: true }
        );

        // Update conversation qualification score
        if (conversationId) {
            await Conversation.findByIdAndUpdate(conversationId, {
                qualificationScore: evaluation.score
            });
        }

        // Record CRM action
        await CRMAction.create({
            conversationId,
            actionType: "lead_logged",
            payload: {
                leadId: lead._id,
                score: evaluation.score,
                priority: evaluation.priority,
                qualificationSnapshot
            },
            status: "synced"
        });

        console.log(`📈 [Lead Logging] Successfully logged Lead (${evaluation.priority} Priority, Score: ${evaluation.score}) for conversation ${conversationId}`);
    } catch (err) {
        console.warn("MongoDB lead logging warning:", err.message);
        lead = {
            customerId,
            conversationId,
            status,
            score: evaluation.score,
            priority: evaluation.priority,
            assignedTo
        };
    }

    return {
        success: true,
        lead,
        evaluation
    };
}

module.exports = {
    calculateLeadScore,
    logLead
};
