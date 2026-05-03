import Redis from "ioredis";
import { env } from "../configs/env.js";

// General use Redis client (SETBIT, GETBIT, Rate limiting)
export const redisClient = new Redis(env.REDIS_URL);

// Pub/Sub requires separate connections
export const redisPub = new Redis(env.REDIS_URL);
export const redisSub = new Redis(env.REDIS_URL);

redisClient.on("error", (err) => console.error("[Redis] Client Error:", err));
redisPub.on("error", (err) => console.error("[Redis] Pub Error:", err));
redisSub.on("error", (err) => console.error("[Redis] Sub Error:", err));

export const REDIS_KEYS = {
  BITFIELD: "checkboxes:state", // Key holding the 1,000,000 bits
  CHANNEL_UPDATES: "checkboxes:updates", // Pub/Sub channel
};
