import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { BranchServices } from "./branch.service";
import AppError from "../../errorHelpers/appError";

const createPartnerBranch = catchAsync(async (req: Request, res: Response) => {
  const result = await BranchServices.createPartnerBranch(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Partner branch created successfully",
    data: result,
  });
});

const getAllPartnerBranches = catchAsync(
  async (req: Request, res: Response) => {
    const result = await BranchServices.getAllPartnerBranches(
      req.query as Record<string, string>,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Partner branches retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

const getAllTrashPartnerBranches = catchAsync(
  async (req: Request, res: Response) => {
    const result = await BranchServices.getAllTrashPartnerBranches(
      req.query as Record<string, string>,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All Trashed Partner branches retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

const getSinglePartnerBranch = catchAsync(
  async (req: Request, res: Response) => {
    const result = await BranchServices.getSinglePartnerBranch(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Partner branch retrieved successfully",
      data: result,
    });
  },
);

const updatePartnerBranch = catchAsync(async (req: Request, res: Response) => {
  const result = await BranchServices.updatePartnerBranch(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner branch updated successfully",
    data: result,
  });
});

const softDeletePartnerBranch = catchAsync(
  async (req: Request, res: Response) => {
    const result = await BranchServices.softDeletePartnerBranch(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Partner branch moved to trash successfully",
      data: result,
    });
  },
);

const deletePartnerBranch = catchAsync(async (req: Request, res: Response) => {
  const result = await BranchServices.deletePartnerBranch(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner branch deleted successfully",
    data: result,
  });
});

const getNearbyBranches = catchAsync(async (req: Request, res: Response) => {
  const { latitude, longitude, partnerIds } = req.query;

  if (!latitude || !longitude || !partnerIds) {
    throw new AppError(httpStatus.BAD_REQUEST, "latitude, longitude and partnerIds are required");
  }

  const result = await BranchServices.getNearbyBranches({
    latitude: Number(latitude),
    longitude: Number(longitude),
    partnerIds: String(partnerIds).split(",").filter(Boolean),
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Nearby branches retrieved successfully",
    data: result.data,
  });
});

const restorePartnerBranch = catchAsync(async (req: Request, res: Response) => {
  const result = await BranchServices.restorePartnerBranch(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner branch restored successfully",
    data: result,
  });
});

export const BranchControllers = {
  createPartnerBranch,
  getAllPartnerBranches,
  getAllTrashPartnerBranches,
  getSinglePartnerBranch,
  updatePartnerBranch,
  softDeletePartnerBranch,
  getNearbyBranches,
  deletePartnerBranch,
  restorePartnerBranch,
};
