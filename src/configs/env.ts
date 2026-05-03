import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "9000", 10),
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  OIDC_ISSUER: process.env.OIDC_ISSUER || "http://localhost:3000",
  OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || "",
  OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || "",
  SESSION_SECRET: process.env.SESSION_SECRET || "konoha-secret-jutsu-2026",
  APP_URL: process.env.APP_URL || "http://localhost:9000",
};
