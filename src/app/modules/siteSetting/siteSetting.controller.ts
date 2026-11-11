import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SiteSettingService } from "./siteSetting.service";

const getSiteSetting = catchAsync(async (req: Request, res: Response) => {
  const result = await SiteSettingService.getSiteSetting();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Site setting retrieved successfully",
    data: result,
  });
});

const updateSiteSetting = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user as JwtPayload;

  await SiteSettingService.updateSiteSetting(
    req.body.staffAccessEnabled,
    decodedToken.userId,
  );

  const result = await SiteSettingService.getSiteSetting();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: result.staffAccessEnabled
      ? "Staff access enabled"
      : "Staff access disabled",
    data: result,
  });
});

export const SiteSettingController = {
  getSiteSetting,
  updateSiteSetting,
};
