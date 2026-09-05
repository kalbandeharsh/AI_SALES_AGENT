const axios = require("axios");
const Escalation = require("../models/Escalation");
const Conversation = require("../models/Conversation");
const CRMAction = require("../models/CRMAction");

/**
 * Step 8: Post rich Slack escalation webhook and record in MongoDB
 * Replaces send_slack_escalation_stub
 */
async function sendSlackEscalation(escalationData) {
    const {
        conversationId,
        reason = "Complex inquiry / human agent requested",
        priority = "HIGH",
        assignedTo = "Sales Engineering On-Call",
        contextSummary = "Customer requested direct human contact regarding technical questions and custom volume pricing.",
        stateFields = {}
    } = escalationData;

    const {
        userCount = "N/A",
        objections = [],
        qualificationScore = 0,
        customerName = "Prospective Client",
        customerPhone = "N/A"
    } = stateFields;

    // 1. Create Escalation record in MongoDB
    let escalationRecord;
    try {
        escalationRecord = await Escalation.create({
            conversationId,
            reason,
            priority,
            assignedTo,
            contextSummary,
            status: "pending"
        });

        if (conversationId) {
            await Conversation.findByIdAndUpdate(conversationId, {
                status: "escalated"
            });
        }
    } catch (err) {
        console.warn("MongoDB escalation persistence warning:", err.message);
        escalationRecord = {
            _id: new Date().getTime().toString(),
            conversationId,
            reason,
            priority,
            assignedTo,
            contextSummary,
            status: "pending"
        };
    }

    // 2. Build Slack Block Kit formatted message
    const objectionsText = Array.isArray(objections) && objections.length > 0
        ? objections.join(", ")
        : "None recorded";

    const slackPayload = {
        text: `🚨 [EchoSphere Escalation] ${reason} - Lead Priority: ${priority}`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `🚨 EchoSphere Sales AI: Live Escalation Alert (${priority})`,
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Reason:* ${reason}\n*Summary:* ${contextSummary}\n*Assigned To:* <@${assignedTo}>`
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Customer:* ${customerName}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Phone:* ${customerPhone}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*User Count:* ${userCount} seats`
                    },
                    {
                        type: "mrkdwn",
                        text: `*BANT Score:* ${qualificationScore}/100`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Objections:* ${objectionsText}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Conversation ID:* \`${conversationId || "active-session"}\``
                    }
                ]
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "Take Over Call in Portal",
                            emoji: true
                        },
                        style: "primary",
                        url: "http://localhost:3000/dashboard"
                    }
                ]
            }
        ]
    };

    // 3. Post to Slack Webhook if configured
    let slackDispatched = false;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (webhookUrl && webhookUrl.startsWith("http")) {
        try {
            const response = await axios.post(webhookUrl, slackPayload, {
                headers: { "Content-Type": "application/json" },
                timeout: 5000
            });
            if (response.status === 200) {
                slackDispatched = true;
                console.log(`✅ [Slack Escalation] Successfully posted escalation to Slack channel.`);
                if (escalationRecord._id) {
                    await Escalation.findByIdAndUpdate(escalationRecord._id, { status: "dispatched" });
                }
            }
        } catch (postErr) {
            console.warn("Slack webhook POST failed:", postErr.message);
        }
    } else {
        console.log(`ℹ️ [Slack Escalation Simulated] No SLACK_WEBHOOK_URL in .env. Formatted Block Kit payload prepared:`);
        console.log(JSON.stringify(slackPayload.blocks[1].text.text, null, 2));
    }

    // 4. Log CRM Action
    try {
        await CRMAction.create({
            conversationId,
            actionType: "slack_escalation",
            payload: {
                escalationId: escalationRecord._id,
                reason,
                priority,
                slackDispatched
            },
            status: slackDispatched ? "sent" : "logged_internally"
        });
    } catch (crmErr) {
        // Silently continue
    }

    return {
        success: true,
        escalation: escalationRecord,
        slackDispatched,
        payload: slackPayload
    };
}

module.exports = {
    sendSlackEscalation
};
