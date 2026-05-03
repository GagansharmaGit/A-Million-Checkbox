import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./configs/env.js";
import authRoutes from "./auth/auth.routes.js";
import { registerSocketHandlers } from "./sockets/handler.js";

const app = express();
const server = http.createServer(app);

// Basic middleware
app.use(cors({
  origin: true, // echo the request origin (needed for cookies with credentials)
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Auth routes (OIDC)
app.use("/auth", authRoutes);

// Serve static frontend
const public_path = path.resolve("./public");
app.use(express.static(public_path));

// Initialize Socket.io
const io = new Server(server, {
  cors: { origin: "*" }
});

registerSocketHandlers(io);

// Start server
server.listen(env.PORT, () => {
  console.log(`[Server] Ninja Checkboxes running on http://localhost:${env.PORT}`);
});
