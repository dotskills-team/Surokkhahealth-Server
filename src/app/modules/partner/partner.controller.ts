import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes";
import { PartnerServices } from "./partner.service";

const createPartner = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const payload = req.body;        

  console.log("Partner create payload ", payload)


  const file = req.file;
  if (file) {
    payload.logo = file.path;       
  }

  console.log("Payload after file ", payload)

  const result = await PartnerServices.createPartner(payload, userId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Partner created successfully",
    data: result,
  });
});

const updatePartner = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const file = req.file;
  if (file) {
    payload.logo = file.path;
  }

  const result = await PartnerServices.updatePartner(req.params.id as string, payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner updated successfully",
    data: result,
  });
});


const getAllPartners = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.getAllPartners(
    req.query as Record<string, string>
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partners retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getAllTrashPartners = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.getAllTrashPartners(
    req.query as Record<string, string>
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trash Partners retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getSinglePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.getSinglePartner(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner retrieved successfully",
    data: result,
  });
});

const softDeletePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.softDeletePartner(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner moved trash successfully",
    data: result,
  });
});

const deletePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.deletePartner(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner deleted successfully",
    data: result,
  });
});

const restorePartner = catchAsync(async (req: Request, res: Response) => {
  const result = await PartnerServices.restorePartner(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Partner restored successfully",
    data: result,
  });
});

export const PartnerController = {
  createPartner,
  getAllPartners,
  getAllTrashPartners,
  getSinglePartner,
  updatePartner,
  softDeletePartner,
  deletePartner,
  restorePartner,
};