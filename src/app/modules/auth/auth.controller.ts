/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { AuthServices } from "./auth.service";
import { sendResponse } from "../../utils/sendResponse";
import AppError from "../../errorHelpers/appError";
import { setAuthCookie } from "../../utils/setCookie";
import { JwtPayload } from "jsonwebtoken";

const staffLogin = catchAsync(async (req: Request, res: Response) => {
  const { phoneNumber, password } = req.body;
  const phone = phoneNumber;

  const loginInfo = await AuthServices.staffLogin(phone, password);

  setAuthCookie(res, {
    accessToken: loginInfo.accessToken,
    refreshToken: loginInfo.refreshToken,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login Successfully",
    data: loginInfo,
  });
});

const sendOtp = catchAsync(async (req: Request, res: Response) => {
  const { phone } = req.body;

  await AuthServices.sendOtp(phone);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent successfully",
    data: null,
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const { phone, otp } = req.body;

  const loginInfo = await AuthServices.verifyOtp(phone, otp);

  setAuthCookie(res, {
    accessToken: loginInfo.accessToken,
    refreshToken: loginInfo.refreshToken,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login Successfully",
    data: loginInfo,
  });
});

const getNewAccessToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new AppError(httpStatus.NOT_FOUND, "Refresh token not found");
    }

    const tokenInfo = await AuthServices.getNewAccessToken(
      refreshToken as string,
    );

    setAuthCookie(res, tokenInfo);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "New Access Token Retrieve Successfully",
      data: tokenInfo,
    });
  },
);

const logout = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Logout Successfully",
      data: null,
    });
  },
);

const changePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const newPassword = req.body.newPassword;
    const oldPassword = req.body.oldPassword;
    const decodedToken = req.user;
    await AuthServices.changePassword(
      oldPassword,
      newPassword,
      decodedToken as JwtPayload,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Password Changed Successfully",
      data: null,
    });
  },
);
const adminChangePassword = catchAsync(async (req: Request, res: Response) => {
  const { userId, newPassword } = req.body;

  await AuthServices.adminChangePassword(userId, newPassword);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: "Password updated by admin",
    data: null,
  });
});

const setPassword = catchAsync(
  async (req: Request, res: Response) => {
    const { password } = req.body;
    const decodedToken = req.user;

    await AuthServices.setPassword(
      decodedToken as JwtPayload,
      password,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Password set successfully",
      data: null,
    });
  },
);

export const AuthControllers = {
  staffLogin,
  sendOtp,
  verifyOtp,
  getNewAccessToken,
  adminChangePassword,
  logout,
  changePassword,
  setPassword,
};
