require("dotenv").config();

const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");
const { Server } = require("socket.io");
const setupRealtime = require("./src/realtime/interruption");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "DELETE"]
    }
});

// Setup Socket.io real-time streaming and interruption handler
setupRealtime(io);

// Connect to MongoDB Atlas
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 EchoSphere Backend Server running on http://localhost:${PORT}`);
        console.log(`⚡ Real-time Socket.io active with sub-80ms interruption handling.`);
    });
}).catch((err) => {
    console.error("Failed to start server due to DB connection error:", err);
});