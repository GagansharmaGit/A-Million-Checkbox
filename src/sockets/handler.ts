import { Server, Socket } from "socket.io";
import { redisClient, redisPub, redisSub, REDIS_KEYS } from "../redis/client.js";
import { checkSocketRateLimit } from "../core/rate-limit.js";
import { jwtVerify } from "jose";
import { env } from "../configs/env.js";
import cookie from "cookie";

const TOTAL_CHECKBOXES = 1_000_000;

interface AuthSocket extends Socket {
  user?: { sub: string; name: string };
}

export function registerSocketHandlers(io: Server) {
  redisSub.subscribe(REDIS_KEYS.CHANNEL_UPDATES, (err: any) => {
    if (err) console.error("[Redis] Subscribe Error:", err);
  });

  redisSub.on("message", (channel: string, message: string) => {
    if (channel === REDIS_KEYS.CHANNEL_UPDATES) {
      try {
        const data = JSON.parse(message);
        io.emit("server:toggle", data);
      } catch (e) {}
    }
  });

  io.use(async (socket: AuthSocket, next) => {
    try {
      const cookiesStr = socket.request.headers.cookie;
      if (cookiesStr) {
        const cookies = cookie.parse(cookiesStr);
        const token = cookies.session_token;
        if (token) {
          const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET));
          socket.user = { sub: payload.sub as string, name: payload.name as string };
        }
      }
    } catch (err) {}
    next();
  });

  io.on("connection", async (socket: AuthSocket) => {
    try {
      const bitfield = await redisClient.getBuffer(REDIS_KEYS.BITFIELD);
      if (bitfield) {
         socket.emit("server:state", bitfield.toString("base64"));
      } else {
         socket.emit("server:state", "");
      }
    } catch (err) {
      console.error("Failed to load initial state", err);
    }

    socket.on("client:toggle", async (data: { index: number; checked: boolean }) => {
      if (!socket.user) {
        socket.emit("server:error", "You must be a registered Ninja to toggle checkboxes!");
        return;
      }

      const { index, checked } = data;
      if (typeof index !== "number" || index < 0 || index >= TOTAL_CHECKBOXES) {
        return;
      }

      const allowed = await checkSocketRateLimit(socket.user.sub, 20, 10);
      if (!allowed) {
        socket.emit("server:error", "Too much chakra! Please slow down.");
        return;
      }

      try {
        await redisClient.setbit(REDIS_KEYS.BITFIELD, index, checked ? 1 : 0);

        const updateMessage = JSON.stringify({ index, checked, by: socket.user.name });
        await redisPub.publish(REDIS_KEYS.CHANNEL_UPDATES, updateMessage);
      } catch (err) {
        console.error("Failed to set bit", err);
      }
    });

  });
}
