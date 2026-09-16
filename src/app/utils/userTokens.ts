import httpStatus from "http-status-codes";

import { envVars } from "../config/env";
import AppError from "../errorHelpers/appError";
import { IsActive, IUser } from "../modules/user/user.interface";
import { generateToken, verifyToken } from "./jwt";
import { User } from "../modules/user/user.model";
import { JwtPayload } from "jsonwebtoken";

export const createUserTokens = (user: Partial<IUser>) => {
  const tokenPayload = {
    userId: user._id,
    phone: user.phone,
    role: user.role,
  };
  const accessToken = generateToken(
    tokenPayload,
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );
  const refreshToken = generateToken(
    tokenPayload,
    envVars.JWT_REFRESH_SECRET,
    envVars.JWT_REFRESH_EXPIRES,
  );
  return {
    accessToken,
    refreshToken,
  };
};

export const createNewAccessTokenWithRefreshToken = async (
  refreshToken: string,
) => {
  const verifiedRefreshToken = verifyToken(
    refreshToken,
    envVars.JWT_REFRESH_SECRET,
  ) as JwtPayload;
  const isUserExist = await User.findOne({
    phone: verifiedRefreshToken.phone,
  }).select("+password");

  if (!isUserExist) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User does not exist! Please register.",
    );
  }

  if (
    isUserExist.isActive === IsActive.INACTIVE ||
    isUserExist.isActive === IsActive.BLOCKED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `User is ${isUserExist.isActive}`,
    );
  }

  if (isUserExist.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is deleted");
  }

  const tokenPayload = {
    userId: isUserExist._id,
    phone: isUserExist.phone,
    role: isUserExist.role,
  };
  const accessToken = generateToken(
    tokenPayload,
    envVars.JWT_ACCESS_SECRET,
    envVars.JWT_ACCESS_EXPIRES,
  );
  return accessToken;
};
