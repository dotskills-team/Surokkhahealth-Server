import httpStatus from "http-status-codes";
import { NextFunction, Request, Response } from "express";
import AppError from "../errorHelpers/appError";
import { JwtPayload } from "jsonwebtoken";
import { envVars } from "../config/env";
import { User } from "../modules/user/user.model";
import { IsActive } from "../modules/user/user.interface";
import { verifyToken } from "../utils/jwt";

export const checkAuth =
  (...authRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accessToken = req.headers.authorization || req.cookies.accessToken;

      if (!accessToken) {
        throw new AppError(httpStatus.NOT_FOUND, "Token not received.");
      }

      const verifiedToken = verifyToken(
        accessToken,
        envVars.JWT_ACCESS_SECRET,
      ) as JwtPayload;

      const isUserExist = await User.findOne({
        phone: verifiedToken.phone,
      });

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

      // console.log("Verified token ", verifiedToken);

      if (!authRoles.includes(verifiedToken.role)) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          "You are not permitted to access this route",
        );
      }

      req.user = verifiedToken;

      next();
    } catch (error) {
      console.log(error);
      next(error);
    }
  };
