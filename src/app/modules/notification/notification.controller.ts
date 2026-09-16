import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes";
import { NotificationService } from "./notification.service";
import { JwtPayload } from "jsonwebtoken";

const createNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.createNotification(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Notification created successfully",
    data: result,
  });
});

const getAllNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await NotificationService.getAllNotifications({
        query: req.query as Record<string, string>,
        user: {
          userId: (req.user as any).userId,
          role: (req.user as any).role,
        },
      });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message:
        "Notifications retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats
    });
  },
);

const getSingleNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getSingleNotification(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.markAsRead(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const softDeleteNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.softDeleteNotification(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
    data: result,
  });
});

const getAllTrashNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await NotificationService.getAllTrashNotifications({
        query: req.query as Record<string, string>,
        user: {
          userId: (req.user as any).userId,
          role: (req.user as any).role,
        },
      });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Trashed notifications retrieved successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.getMyNotifications({
    query: req.query as Record<string, string>,
    userId: (req.user as any).userId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your notifications retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const restoreNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.restoreNotification(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification restored successfully",
    data: result,
  });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  const result = await NotificationService.deleteNotification(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification permanently deleted",
    data: result,
  });
});

export const NotificationController = {
  createNotification,
  getAllNotifications,
  getMyNotifications,
  getSingleNotification,
  markAsRead,
  softDeleteNotification,
  getAllTrashNotifications,
  restoreNotification,
  deleteNotification,
};