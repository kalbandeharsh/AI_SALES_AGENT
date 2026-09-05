const { retrieveKnowledge } = require("../services/rag.service");
const { getAvailability, createMeeting } = require("../integrations/calendar/calendar");
const { calculateLeadScore, logLead } = require("../services/qualification.service");
const { sendSlackEscalation } = require("../services/escalation.service");
const tools = require("./tools");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Requirement = require("../models/Requirement");
const Objection = require("../models/Objection");

/**
 * VantageVoice LangGraph Brain
 * A state-machine directed graph for conversational sales reasoning,
 * continuous memory, RAG factual grounding, BANT qualification, and goal-driven outcomes.
 */

class VantageVoiceGraph {
    constructor() {
        this.nodes = new Map();
    }

    /**
     * Node 1: Intent & Requirement Analyzer Node
     * Extracts objections, requirement shifts, and conversational intent
     */
    async intentAnalyzerNode(state) {
        const text = state.lastUserMessage.toLowerCase();
        const extracted = { ...state.userRequirements };
        const objections = [...state.objections];
        let intent = "general_discovery";

        // Detect user seats / volume requirement changes
        const seatMatch = text.match(/(\d+)\s*(user|seat|rep|license|people)/);
        if (seatMatch) {
            extracted.userCount = parseInt(seatMatch[1], 10);
        } else if (text.includes("200")) {
            extracted.userCount = 200;
        } else if (text.includes("50")) {
            extracted.userCount = 50;
        } else if (text.includes("10")) {
            extracted.userCount = 10;
        }

        // Detect Timeline signals
        if (text.includes("immediate") || text.includes("asap") || text.includes("this month") || text.includes("urgent")) {
            extracted.timeline = "immediate";
        } else if (text.includes("quarter") || text.includes("next month")) {
            extracted.timeline = "short";
        }

        // Detect Authority signals
        if (text.includes("vp") || text.includes("director") || text.includes("head") || text.includes("founder") || text.includes("ceo") || text.includes("cro")) {
            extracted.authorityRole = "decision_maker";
        }

        // Detect Objections
        if (text.includes("expensive") || text.includes("budget") || text.includes("too high") || text.includes("costly")) {
            objections.push({ type: "price", text: state.lastUserMessage, resolved: false });
            intent = "objection_handling";
        } else if (text.includes("competitor") || text.includes("bland") || text.includes("retell") || text.includes("air.ai") || text.includes("already using")) {
            objections.push({ type: "competitor", text: state.lastUserMessage, resolved: false });
            intent = "competitor_objection";
        } else if (text.includes("human") || text.includes("speak to a person") || text.includes("real person") || text.includes("supervisor")) {
            intent = "human_escalation";
        } else if (text.includes("book") || text.includes("schedule") || text.includes("demo") || text.includes("calendar") || text.includes("meeting") || text.includes("confirm")) {
            intent = "booking_intent";
        } else if (text.includes("price") || text.includes("pricing") || text.includes("cost") || text.includes("rate") || text.includes("tier")) {
            intent = "pricing_inquiry";
        } else if (text.includes("feature") || text.includes("latency") || text.includes("interruption") || text.includes("agora") || text.includes("integration")) {
            intent = "feature_inquiry";
        }

        return {
            ...state,
            userRequirements: extracted,
            objections,
            intent,
            currentStage: intent === "booking_intent" ? "closing" : (intent.includes("objection") ? "objection_handling" : "qualification")
        };
    }

    /**
     * Node 2: RAG Factual Grounding Node
     * Injects verified facts from knowledge base to prevent hallucinations
     */
    async ragNode(state) {
        const query = state.lastUserMessage;
        let category = null;

        if (state.intent === "pricing_inquiry" || state.intent === "objection_handling") {
            category = "pricing";
        } else if (state.intent === "competitor_objection") {
            category = "competitor";
        } else if (state.intent === "feature_inquiry") {
            category = "features";
        }

        const chunks = await retrieveKnowledge(query, { topK: 3, category });

        return {
            ...state,
            ragContext: chunks
        };
    }

    /**
     * Node 3: BANT Qualification Node
     * Scores lead based on conversation memory and updates MongoDB
     */
    async qualificationNode(state) {
        const evaluation = calculateLeadScore({
            userCount: state.userRequirements.userCount || 1,
            budgetMonthly: state.userRequirements.budgetMonthly || 0,
            timeline: state.userRequirements.timeline || "medium",
            authorityRole: state.userRequirements.authorityRole || "influencer",
            needIntensity: state.userRequirements.needIntensity || "high",
            objectionsCount: state.objections.filter(o => !o.resolved).length
        });

        // Persist Lead update to MongoDB
        let leadRecord = null;
        try {
            const result = await logLead({
                customerId: state.customerId,
                conversationId: state.conversationId,
                qualificationSnapshot: state.userRequirements,
                status: evaluation.score >= 70 ? "qualified" : "in_progress"
            });
            leadRecord = result.lead;
        } catch (e) {
            console.warn("LangGraph qualification logging warning:", e.message);
        }

        return {
            ...state,
            qualificationScore: evaluation.score,
            priority: evaluation.priority,
            leadRecord
        };
    }

    /**
     * Node 4: Objection Resolution Node
     * Handles pricing, competitor, or timing objections empathetically
     */
    async objectionNode(state) {
        const lastObj = state.objections[state.objections.length - 1];
        let objectionResponse = "";

        if (lastObj?.type === "competitor") {
            objectionResponse = "I completely understand exploring options! Where VantageVoice stands apart from tools like Bland or Retell is in three concrete ways: first, our Agora-powered real-time voice pipeline provides sub-450ms turnaround without robotic pauses; second, our deterministic RAG memory eliminates pricing hallucinations; and third, our built-in LangGraph brain logs qualified leads and books calendar appointments directly into your CRM.";
        } else if (lastObj?.type === "price") {
            const count = state.userRequirements.userCount || 50;
            const quote = await tools.getProductPricing({ userCount: count, tier: "enterprise" });
            objectionResponse = `I hear your concern about budget. For a team of ${count}, we apply a ${quote.volumeDiscountApplied} volume discount plus an additional 20% off on annual commitments, bringing your effective rate down to just $${quote.effectivePerUserMonthly}/seat/month—all with unlimited voice minutes. Would you like to review an itemized ROI breakdown?`;
        } else {
            objectionResponse = "That is a very valid point. Let's make sure all your specific requirements and compliance needs are addressed.";
        }

        // Mark objection as addressed
        if (lastObj) lastObj.resolved = true;

        return {
            ...state,
            objectionResponse
        };
    }

    /**
     * Node 5: Goal-Driven Outcome Node
     * Automatically steers the call toward a concrete outcome:
     * (A) Booked Meeting, (B) Qualified Lead, or (C) Scheduled Follow-up
     */
    async outcomeNode(state) {
        const text = state.lastUserMessage.toLowerCase();
        let targetOutcome = "continue_discovery";
        let outcomeReply = "";
        const actionsTaken = [];

        // 1. Check if Escalation is needed
        if (state.intent === "human_escalation") {
            const esc = await tools.escalateToHuman({
                conversationId: state.conversationId,
                reason: "Customer requested human supervisor",
                priority: state.priority || "HIGH",
                contextSummary: `Prospect query: "${state.lastUserMessage}"`,
                stateFields: {
                    userCount: state.userRequirements.userCount || "N/A",
                    qualificationScore: state.qualificationScore,
                    objections: state.objections.map(o => o.text)
                }
            });
            actionsTaken.push({ tool: "escalateToHuman", result: esc });
            targetOutcome = "escalate_human";
            outcomeReply = "I have immediately alerted our senior sales engineering team via Slack with your call context and qualification details. A human account executive is standing by to take over. How else can I assist you in the meantime?";
        }
        // 2. Check if Booking is requested or highly qualified
        else if (state.intent === "booking_intent" || (state.qualificationScore >= 75 && (text.includes("yes") || text.includes("sure") || text.includes("demo")))) {
            const availability = await tools.checkCalendarAvailability();
            const firstSlot = availability.slots.find(s => s.available);

            if (text.includes("confirm") || text.includes("book") || text.includes("yes")) {
                const booking = await tools.bookMeeting({
                    customerId: state.customerId,
                    conversationId: state.conversationId,
                    title: "VantageVoice AI Sales - Executive Demo",
                    startTime: firstSlot ? firstSlot.startTime : new Date(Date.now() + 86400000).toISOString(),
                    customerEmail: "prospect@acmecorp.com",
                    customerName: "Executive Prospect"
                });
                actionsTaken.push({ tool: "bookMeeting", result: booking });
                targetOutcome = "book_meeting";
                outcomeReply = `Fantastic! I've booked your executive demo for ${new Date(booking.startTime).toLocaleDateString()} at ${new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC. Your Google Meet link (${booking.meetingLink}) and calendar invite have been issued!`;
            } else {
                actionsTaken.push({ tool: "checkCalendarAvailability", result: availability });
                targetOutcome = "book_meeting";
                const slotTimes = availability.slots.filter(s => s.available).slice(0, 3).map(s => s.time).join(", ");
                outcomeReply = `With your team size and timeline, an executive demo is the fastest way to test our sub-450ms voice latency live. We have slots open at ${slotTimes} UTC. Would you like me to reserve one for you?`;
            }
        }
        // 3. Pricing Inquiry with Volume Grounding
        else if (state.intent === "pricing_inquiry") {
            const count = state.userRequirements.userCount || 200;
            const isAnnual = text.includes("annual") || text.includes("year");
            const quote = await tools.getProductPricing({
                userCount: count,
                tier: count >= 50 ? "enterprise" : "growth",
                billingCycle: isAnnual ? "annual" : "monthly"
            });
            actionsTaken.push({ tool: "getProductPricing", result: quote });
            targetOutcome = "qualify_lead";
            outcomeReply = `For ${count} users, our ${quote.recommendedTier} tier is $${quote.baseListPricePerUser}/seat/month. Applying our ${quote.volumeDiscountApplied} volume discount, the rate is $${quote.effectivePerUserMonthly} per user ($${quote.monthlyTotal.toLocaleString()}/mo). On an annual agreement, you get an additional 20% discount and waived enterprise onboarding! Shall we lock in a demo slot to review your custom quote?`;
        }
        // 4. Competitor / Objection Handling Response
        else if (state.objectionResponse) {
            outcomeReply = `${state.objectionResponse} Would you be open to a quick 15-minute live side-by-side call to test the audio quality yourself?`;
            targetOutcome = "qualify_lead";
        }
        // 5. Discovery & Follow-up Scheduling
        else {
            const topFact = state.ragContext?.[0]?.content?.replace(/###\s*[^\n]+\n/, "").split("\n\n")[0];
            const factPrefix = topFact ? `${topFact} ` : "";
            outcomeReply = `${factPrefix}VantageVoice is engineered to qualify leads, handle objections, and book calendar meetings autonomously over Agora voice channels. What is the current size of your SDR or sales team?`;
            targetOutcome = "continue_discovery";
        }

        return {
            ...state,
            targetOutcome,
            actionsTaken,
            agentResponse: outcomeReply
        };
    }

    /**
     * Execute full LangGraph flow:
     * Intent Analyzer -> RAG Factual Grounding -> BANT Qualification -> Objection/Outcome Node
     */
    async execute(initialState) {
        // Step 1: Intent & Requirement Analyzer
        let state = await this.intentAnalyzerNode(initialState);

        // Step 2: RAG Factual Grounding
        state = await this.ragNode(state);

        // Step 3: BANT Lead Qualification
        state = await this.qualificationNode(state);

        // Step 4: Objection handling (conditional)
        if (state.intent.includes("objection")) {
            state = await this.objectionNode(state);
        }

        // Step 5: Outcome & Action generation
        state = await this.outcomeNode(state);

        return state;
    }
}

const langGraphBrain = new VantageVoiceGraph();

module.exports = {
    VantageVoiceGraph,
    langGraphBrain
};
