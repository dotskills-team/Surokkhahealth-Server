import Redis from "ioredis";
import { envVars } from "./env";

export const redisClient = new Redis({
  host: envVars.REDIS_HOST,
  port: Number(envVars.REDIS_PORT),
  username: envVars.REDIS_USERNAME,
  password: envVars.REDIS_PASSWORD,
});

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

redisClient.on("ready", () => {
  console.log("🚀 Redis Ready");
});

redisClient.on("error", (err) => {
  console.log("❌ Redis Error:", err);
});
