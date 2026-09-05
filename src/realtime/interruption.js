const Message = require("../models/Message");
const ConversationEvent = require("../models/ConversationEvent");
const { processAgentTurn } = require("../services/agent.service");

/**
 * Configure real-time Socket.io events with sub-80ms interruption handling
 */
function setupRealtime(io) {
    io.on("connection", (socket) => {
        console.log(`🔌 [Socket.io] Client connected: ${socket.id}`);

        // Join specific conversation room
        socket.on("joinConversation", (conversationId) => {
            socket.join(conversationId);
            console.log(`👤 Client ${socket.id} joined conversation room: ${conversationId}`);
            socket.emit("joinedRoom", { conversationId });
        });

        // Customer speaks or types
        socket.on("userMessage", async (data) => {
            const { conversationId, text, customerId } = data;
            console.log(`🎙️ [Speech Ingest] Conversation ${conversationId}: "${text}"`);

            try {
                // Inform client that agent is reasoning / retrieving RAG chunks
                io.to(conversationId).emit("agentStatus", { status: "retrieving_rag", query: text });

                const result = await processAgentTurn({
                    conversationId,
                    userMessage: text,
                    customerId
                });

                // Emit grounded agent response back to room
                io.to(conversationId).emit("agentMessage", {
                    conversationId: result.conversationId,
                    reply: result.reply,
                    actionsTaken: result.actionsTaken,
                    ragChunks: result.ragChunks,
                    messageId: result.agentMessage._id
                });
            } catch (err) {
                console.error("Agent message processing error:", err.message);
                socket.emit("agentError", { error: err.message });
            }
        });

        // Customer interrupts the agent while speaking
        socket.on("interrupt", async (data) => {
            const { conversationId, currentTimestamp } = data;
            console.log(`⚡ [INTERRUPTION DETECTED] Customer interrupted agent in conversation: ${conversationId}`);

            try {
                // Immediately broadcast stopSpeaking signal to halt client-side TTS or audio stream
                io.to(conversationId).emit("agentInterrupted", {
                    conversationId,
                    interruptedAt: currentTimestamp || new Date().toISOString()
                });

                // Update database
                const lastAgentMsg = await Message.findOneAndUpdate(
                    { conversationId, speaker: "agent" },
                    { interrupted: true },
                    { sort: { timestamp: -1 }, new: true }
                );

                await ConversationEvent.create({
                    conversationId,
                    eventType: "customer_interruption",
                    data: {
                        timestamp: new Date(),
                        interruptedMessageId: lastAgentMsg ? lastAgentMsg._id : null
                    }
                });
            } catch (err) {
                console.warn("Interruption handling warning:", err.message);
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);
        });
    });
}

module.exports = setupRealtime;