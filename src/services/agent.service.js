const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Customer = require("../models/Customer");
const Requirement = require("../models/Requirement");
const Objection = require("../models/Objection");
const { langGraphBrain } = require("../ai/langgraph_agent_brain");

/**
 * VantageVoice Conversational Orchestration Agent
 * Powered by LangGraph StateGraph Brain for reasoning, memory, RAG grounding,
 * BANT qualification, and goal-directed outcomes.
 */
async function processAgentTurn({ conversationId, userMessage, customerId = null }) {
    // 1. Ensure or retrieve Conversation
    let conversation;
    if (conversationId) {
        try {
            conversation = await Conversation.findById(conversationId);
        } catch (e) {
            // invalid ObjectId or string session id
        }
    }

    if (!conversation) {
        let customer;
        if (customerId) {
            try {
                customer = await Customer.findById(customerId);
            } catch (e) {}
        }
        if (!customer) {
            customer = await Customer.create({
                name: "Prospective Enterprise Client",
                email: "lead@enterprise.com",
                phone: "+1-800-555-0199",
                companyName: "Acme Corp",
                industry: "B2B SaaS"
            });
        }

        conversation = await Conversation.create({
            customerId: customer._id,
            status: "active",
            currentStage: "discovery",
            intent: "discovery",
            qualificationScore: 20
        });
    }

    // 2. Persist user message to conversation history
    const userMsgRecord = await Message.create({
        conversationId: conversation._id,
        speaker: "customer",
        message: userMessage,
        timestamp: new Date()
    });

    // 3. Load prior requirements and unresolved objections from conversation memory
    let existingRequirements = {};
    try {
        const reqList = await Requirement.find({ conversationId: conversation._id }).lean();
        reqList.forEach(r => { existingRequirements[r.key] = r.value; });
    } catch (e) {}

    let existingObjections = [];
    try {
        existingObjections = await Objection.find({ conversationId: conversation._id, resolved: false }).lean();
    } catch (e) {}

    // 4. Construct LangGraph State
    const initialState = {
        conversationId: conversation._id,
        customerId: conversation.customerId,
        lastUserMessage: userMessage,
        currentStage: conversation.currentStage || "discovery",
        userRequirements: existingRequirements,
        objections: existingObjections,
        ragContext: [],
        qualificationScore: conversation.qualificationScore || 20,
        priority: "MEDIUM",
        targetOutcome: "continue_discovery",
        actionsTaken: [],
        agentResponse: ""
    };

    // 5. Execute LangGraph Brain (Intent -> RAG -> Qualification -> Objection -> Outcome)
    const finalGraphState = await langGraphBrain.execute(initialState);

    // 6. Update requirements in MongoDB if newly extracted
    if (finalGraphState.userRequirements.userCount) {
        await Requirement.findOneAndUpdate(
            { conversationId: conversation._id, key: "userCount" },
            {
                conversationId: conversation._id,
                key: "userCount",
                value: finalGraphState.userRequirements.userCount,
                confidence: 0.95,
                updatedAt: new Date()
            },
            { new: true, upsert: true }
        );
    }

    // 7. Update Conversation stage & score
    await Conversation.findByIdAndUpdate(conversation._id, {
        currentStage: finalGraphState.currentStage,
        qualificationScore: finalGraphState.qualificationScore,
        status: finalGraphState.targetOutcome === "escalate_human" ? "escalated" : "active"
    });

    // 8. Persist Agent response message
    const agentMsgRecord = await Message.create({
        conversationId: conversation._id,
        speaker: "agent",
        message: finalGraphState.agentResponse,
        metadata: {
            actionsTaken: finalGraphState.actionsTaken.map(a => a.tool || a),
            ragChunkCount: finalGraphState.ragContext.length,
            targetOutcome: finalGraphState.targetOutcome,
            qualificationScore: finalGraphState.qualificationScore
        },
        timestamp: new Date()
    });

    return {
        conversationId: conversation._id,
        userMessage: userMsgRecord,
        agentMessage: agentMsgRecord,
        actionsTaken: finalGraphState.actionsTaken,
        ragChunks: finalGraphState.ragContext,
        targetOutcome: finalGraphState.targetOutcome,
        qualificationScore: finalGraphState.qualificationScore,
        reply: finalGraphState.agentResponse
    };
}

module.exports = {
    processAgentTurn
};
