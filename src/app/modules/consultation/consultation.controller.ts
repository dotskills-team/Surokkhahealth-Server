

import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ConsultationServices } from "./consultation.service";

const initiateConsultation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const result = await ConsultationServices.initiateConsultation(userId);
   console.log("consultant init res", result);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Consultation initiated successfully",
    data: result,
  });
});

const updateConsultationStatus = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ConsultationServices.updateConsultationStatus(
      req.params.id as string,
      req.body,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Consultation status updated successfully",
      data: result,
    });
  },
);

const getPrescription = catchAsync(async (req: Request, res: Response) => {
  const result = await ConsultationServices.fetchPrescription(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.ready
      ? "Prescription retrieved successfully"
      : "Prescription is not ready yet, please try again shortly",
    data: result,
  });
});

const getActiveConsultation = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const result = await ConsultationServices.getActiveConsultationForSocket(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result
      ? "Active consultation found"
      : "No active consultation to listen for",
    data: result,
  });
});

const getMyConsultations = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const userId = (req as any).user.userId;

  const result = await ConsultationServices.getMyConsultations({
    query: query as Record<string, string>,
    userId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My consultations retrieved successfully",
    data: result,
  });
});

const getMyConsultationCount = catchAsync(
  async (req: Request, res: Response) => {
    const userId = (req as any).user.userId;

    const result = await ConsultationServices.getMyConsultationCount(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Consultation count retrieved successfully",
      data: result,
    });
  },
);

const getSingleConsultation = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ConsultationServices.getSingleConsultation(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Consultation retrieved successfully",
      data: result,
    });
  },
);

export const ConsultationControllers = {
  initiateConsultation,
  updateConsultationStatus,
  getPrescription,
  getActiveConsultation,
  getMyConsultations,
  getMyConsultationCount,
  getSingleConsultation,
};