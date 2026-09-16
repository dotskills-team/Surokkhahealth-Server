import httpStatus from "http-status-codes";
import bcryptjs from "bcryptjs";
import { JwtPayload } from "jsonwebtoken";

import { User } from "../user/user.model";
import { Role } from "../user/user.interface";

import AppError from "../../errorHelpers/appError";
import { envVars } from "../../config/env";

import {
  createNewAccessTokenWithRefreshToken,
  createUserTokens,
} from "../../utils/userTokens";

import { generateOTP } from "../../utils/otp";
import {
  saveOTP,
  getOTP,
  deleteOTP,
} from "../../utils/otpRedis";
import { sendSMS } from "../../utils/sendSms";
import { MessageType } from "../message/message.interface";

const staffLogin = async (
  phone: string,
  password: string,
) => {

  const user = await User.findOne({ phone }).select(
    "+password",
  );

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  const isPasswordMatched =
    await bcryptjs.compare(
      password,
      user.password as string,
    );

  if (!isPasswordMatched) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid credentials",
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const userTokens = createUserTokens(user);

  const { password: _, ...rest } =
    user.toObject();

  return {
    accessToken: userTokens.accessToken,
    refreshToken: userTokens.refreshToken,
    user: rest,
  };
};

const sendOtp = async (phone: string) => {
  const user = await User.findOne({
    phone: phone,
    role: Role.CUSTOMER,
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Customer not found",
    );
  }

  const otp = generateOTP();

  await saveOTP(phone, otp);

  await sendSMS(
    phone,
    // `Your OTP is ${otp}`,
     ` Your One-Time Password (OTP) is: ${otp}. This code is valid for 2 minutes. Please do not share it with anyone.`,
    MessageType.OTP
  );

  return null;
};

const verifyOtp = async (
  phone: string,
  otp: string,
) => {
  const user = await User.findOne({
    phone,
    role: Role.CUSTOMER,
  });

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Customer not found",
    );
  }

  const storedOtp = await getOTP(phone);

  if (!storedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP expired"
    );
  }

  if (storedOtp !== otp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid OTP"
    );
  }

  await deleteOTP(phone);

  user.lastLoginAt = new Date();

  if (!user.isVerified) {
    user.isVerified = true;
  }

  await user.save();

  const userTokens = createUserTokens(user);

  const { password: _, ...rest } =
    user.toObject();

  return {
    accessToken: userTokens.accessToken,
    refreshToken: userTokens.refreshToken,
    user: rest,
  };
};

const getNewAccessToken = async (
  refreshToken: string,
) => {
  const newAccessToken =
    await createNewAccessTokenWithRefreshToken(
      refreshToken,
    );

  return {
    accessToken: newAccessToken,
  };
};

const changePassword = async (
  oldPassword: string,
  newPassword: string,
  decodedToken: JwtPayload,
) => {
  const user = await User.findById(
    decodedToken.userId,
  ).select("+password");

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  const isOldPasswordMatch =
    await bcryptjs.compare(
      oldPassword,
      user.password as string,
    );

  if (!isOldPasswordMatch) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Old password does not match",
    );
  }

  user.password = await bcryptjs.hash(
    newPassword,
    Number(envVars.BCRYPT_SALT_ROUND),
  );

  await user.save();

  return null;
};

const adminChangePassword = async (
  userId: string,
  newPassword: string,
) => {
  const user = await User.findById(
    userId,
  ).select("+password");

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  user.password = await bcryptjs.hash(
    newPassword,
    Number(envVars.BCRYPT_SALT_ROUND),
  );

  await user.save();

  return null;
};

const setPassword = async (
  decodedToken: JwtPayload,
  password: string,
) => {
  const user = await User.findById(
    decodedToken.userId,
  ).select("+password");

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  if (user.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password already set, use change password instead",
    );
  }

  user.password = await bcryptjs.hash(
    password,
    Number(envVars.BCRYPT_SALT_ROUND),
  );

  await user.save();

  return null;
};


export const AuthServices = {
  staffLogin,
  sendOtp,
  verifyOtp,
  getNewAccessToken,
  changePassword,
  adminChangePassword,
  setPassword
};