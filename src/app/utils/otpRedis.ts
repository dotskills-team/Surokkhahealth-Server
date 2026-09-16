import { redisClient } from "../config/redis";

const OTP_EXPIRE_SECONDS = 300;

export const saveOTP = async (
  phone: string,
  otp: string,
) => {
  await redisClient.set(
    `otp:${phone}`,
    otp,
    "EX",
    OTP_EXPIRE_SECONDS,
  );
};

export const getOTP = async (
  phone: string,
) => {
  return redisClient.get(`otp:${phone}`);
};

export const deleteOTP = async (
  phone: string,
) => {
  return redisClient.del(`otp:${phone}`);
};