export const zaynaxConfig = {
  // baseUrl: process.env.ZAYNAX_BASE_URL || "https://api.zaynax.health",
  baseUrl: process.env.ZAYNAX_BASE_URL || "https://api.zaynaxhealth.com",
  clientId: process.env.ZAYNAX_CLIENT_ID as string,
  secretKey: process.env.ZAYNAX_SECRET_KEY as string, // AES-256-CBC key
  iv: process.env.ZAYNAX_IV as string, // AES-256-CBC IV
  videoCallBaseUrl: process.env.ZAYNAX_VIDEO_CALL_BASE_URL || "https://meet.jit.si",
};