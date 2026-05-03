import { Request, Response, NextFunction } from "express";
import { redisClient } from "../redis/client.js";

export const httpRateLimiter = (options: { windowMs: number; max: number }) => {
  const windowSecs = Math.floor(options.windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const currentWindow = Math.floor(Date.now() / options.windowMs);
    const key = `rate-limit:http:${ip}:${currentWindow}`;

    try {
      const count = await redisClient.incr(key);
      
      if (count === 1) {
        await redisClient.expire(key, windowSecs + 1);
      }

      if (count > options.max) {
         res.status(429).json({ error: "Too many requests. Ninja rest required." });
         return;
      }

      next();
    } catch (err) {
      console.error("[RateLimit] Error:", err);
      next();
    }
  };
};

export async function checkSocketRateLimit(
  socketId: string, 
  maxEvents: number, 
  windowSecs: number
): Promise<boolean> {
  const currentWindow = Math.floor(Date.now() / (windowSecs * 1000));
  const key = `rate-limit:ws:${socketId}:${currentWindow}`;

  try {
    const count = await redisClient.incr(key);
    if (count === 1) {
      await redisClient.expire(key, windowSecs + 1);
    }
    return count <= maxEvents;
  } catch (err) {
    console.error("[SocketRateLimit] Error:", err);
    return true;
  }
}
