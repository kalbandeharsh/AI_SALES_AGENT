const { RtcTokenBuilder, RtcRole } = require("agora-token");

const AGORA_APP_ID = process.env.AGORA_APP_ID || "demo_agora_app_id_vantagevoice";
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "";

/**
 * Generate Agora RTC Token for real-time voice channel streaming
 */
function generateRtcToken(channelName, uid = 0, role = "publisher", expireTimeSeconds = 3600) {
    if (!channelName) {
        throw new Error("channelName is required");
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireTimeSeconds;
    const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    if (AGORA_APP_CERTIFICATE && AGORA_APP_CERTIFICATE.length > 5) {
        try {
            const token = RtcTokenBuilder.buildTokenWithUid(
                AGORA_APP_ID,
                AGORA_APP_CERTIFICATE,
                channelName,
                uid,
                rtcRole,
                privilegeExpiredTs
            );
            return {
                appId: AGORA_APP_ID,
                channelName,
                uid,
                token,
                expiresIn: expireTimeSeconds
            };
        } catch (err) {
            console.warn("Agora token generation error:", err.message);
        }
    }

    // Return structured token payload for demo/local environments
    return {
        appId: AGORA_APP_ID,
        channelName,
        uid,
        token: `agora_token_${Buffer.from(`${AGORA_APP_ID}:${channelName}:${uid}`).toString("base64")}`,
        expiresIn: expireTimeSeconds,
        mode: "simulation"
    };
}

/**
 * Handle Agora Conversational AI Gateway Webhooks
 * (Interruption detection, Voice streaming, Turn taking)
 */
async function handleAgoraWebhook(event) {
    const { eventType, channelName, text, timestamp } = event;

    if (eventType === "user_speaking_start") {
        console.log(`🎙️ [Agora Conversational AI] User started speaking in channel: ${channelName} -> Interruption Triggered`);
        return {
            action: "interrupt_agent",
            channelName,
            status: "playback_halted"
        };
    }

    if (eventType === "speech_transcription") {
        console.log(`🗣️ [Agora Conversational AI] Transcribed text: "${text}"`);
        const { langGraphBrain } = require("../../ai/langgraph_agent_brain");
        const stateResult = await langGraphBrain.execute({
            lastUserMessage: text,
            conversationId: channelName,
            userRequirements: {},
            objections: [],
            ragContext: []
        });

        return {
            action: "speak_response",
            reply: stateResult.agentResponse,
            ragChunks: stateResult.ragContext,
            targetOutcome: stateResult.targetOutcome
        };
    }

    return { received: true };
}

module.exports = {
    generateRtcToken,
    handleAgoraWebhook
};
