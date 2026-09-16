import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PackageServices } from "./insurancePackage.service";

const createPackage = catchAsync(async (req: Request, res: Response) => {

    const payload = req.body;
    const file = req.file;
    if (file) {
        payload.featureImage = file.path;
    }

    const result = await PackageServices.createPackage(payload);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Package created successfully",
        data: result,
    });
});

const getAllPackages = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const result = await PackageServices.getAllPackages(query as Record<string, string>);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "All packages retrieved successfully",
        data: result,
    });
});

const getAllTrashPackages = catchAsync(async (req: Request, res: Response) => {
    const query = req.query;

    const result = await PackageServices.getAllTrashPackages(query as Record<string, string>);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "All trash packages retrieved successfully",
        data: result,
    });
});

const getSinglePackage = catchAsync(async (req: Request, res: Response) => {
    const result = await PackageServices.getSinglePackage(
        req.params.id as string,
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Package retrieved successfully",
        data: result,
    });
});

const updatePackage = catchAsync(async (req: Request, res: Response) => {

       const payload = {
          ...req.body,
          featureImage: req.file?.path,
        };

    const result = await PackageServices.updatePackage(
        req.params.id as string,
        payload,
    );


    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Package updated successfully",
        data: result,
    });
});

const softDeletePackage = catchAsync(async (req: Request, res: Response) => {
    const result = await PackageServices.softDeletePackage(req.params.id as string);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Package moved to trash successfully",
        data: result,
    });
});

const deletePackage = catchAsync(async (req: Request, res: Response) => {
    const result = await PackageServices.deletePackage(req.params.id as string);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Package deleted successfully",
        data: result,
    });
});

export const PackageControllers = {
    createPackage,
    getAllPackages,
    getAllTrashPackages,
    getSinglePackage,
    updatePackage,
    softDeletePackage,
    deletePackage,
};