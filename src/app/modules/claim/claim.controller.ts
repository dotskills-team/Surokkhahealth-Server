import { Request, Response } from "express";
import httpStatus from "http-status-codes";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { ClaimService } from "./claim.service";

const createClaim = catchAsync(
  async (
    req: Request,
    res: Response,
  ) => {
    const payload = req.body;

    const files = req.files as Express.Multer.File[];

    if (files?.length) {
      payload.attachments = files.map(
        (file) => file.path,
      );
    }

    const result =
      await ClaimService.createClaim(
        payload,
      );

    sendResponse(res, {
      statusCode:
        httpStatus.CREATED,
      success: true,
      message:
        "Claim created successfully",
      data: result,
    });
  },
);


const getAllClaims = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await ClaimService.getAllClaims(
        {
          query:
            req.query as Record<
              string,
              string
            >,
          user: {
            userId:
              (
                req.user as any
              ).userId,
            role:
              (
                req.user as any
              ).role,
          },
        },
      );

    sendResponse(res, {
      statusCode:
        httpStatus.OK,
      success: true,
      message:
        "Claims retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats:
        result.stats,
    });
  },
);

const getAllTrashClaims = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ClaimService.getAllTrashClaims({
      query: req.query as Record<string, string>,
      user: {
        userId: (req.user as any).userId,
        role: (req.user as any).role,
      },
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All trash claims retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);
const getSingleClaim =
  catchAsync(
    async (
      req: Request,
      res: Response,
    ) => {
      const result =
        await ClaimService.getSingleClaim(
          req.params
            .id as string,
        );

      sendResponse(res, {
        statusCode:
          httpStatus.OK,
        success: true,
        message:
          "Claim retrieved successfully",
        data: result,
      });
    },
  );

const updateClaim = catchAsync(
  async (
    req: Request,
    res: Response
  ) => {
    const payload = req.body;

    const files = req.files as Express.Multer.File[];

    if (files?.length) {
      payload.attachments = files.map(
        (file) => file.path,
      );
    }

    const result =
      await ClaimService.updateClaim(
        req.params.id as string,
        payload,
      );

    sendResponse(res, {
      statusCode:
        httpStatus.OK,
      success: true,
      message:
        "Claim updated successfully",
      data: result,
    });
  },
);


const reviewClaim =
  catchAsync(
    async (
      req: Request,
      res: Response,
    ) => {
      const adminId =
        (
          req.user as any
        ).userId;

      const result =
        await ClaimService.reviewClaim(
          req.params
            .id as string,
          req.body,
          adminId,
        );

      sendResponse(res, {
        statusCode:
          httpStatus.OK,
        success: true,
        message:
          "Claim reviewed successfully",
        data: result,
      });
    },
  );

const softDeleteClaim =
  catchAsync(
    async (
      req: Request,
      res: Response,
    ) => {
      const result =
        await ClaimService.softDeleteClaim(
          req.params
            .id as string,
        );

      sendResponse(res, {
        statusCode:
          httpStatus.OK,
        success: true,
        message:
          "Claim soft deleted successfully",
        data: result,
      });
    },
  );

  const restoreClaim = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ClaimService.restoreClaim(req.params.id as string);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Claim restored successfully",
      data: result,
    });
  },
);

const deleteClaim = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ClaimService.deleteClaim(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Claim permanently deleted successfully",
      data: result,
    });
  },
);

export const ClaimController = {
  createClaim,
  getAllClaims,
  getSingleClaim,
  updateClaim,
  reviewClaim,
  softDeleteClaim,
  getAllTrashClaims,
  deleteClaim,
  restoreClaim,
};