import crypto from "crypto";
import { zaynaxConfig } from "../config/zaynax.config";

const ALGORITHM = "aes-256-cbc";

const encrypt = (data: Record<string, unknown>): string => {
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    zaynaxConfig.secretKey,
    zaynaxConfig.iv,
  );

  let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted;
};

const decrypt = <T = Record<string, unknown>>(encryptedData: string): T => {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    zaynaxConfig.secretKey,
    zaynaxConfig.iv,
  );

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
};

export const ZaynaxCrypto = {
  encrypt,
  decrypt,
};