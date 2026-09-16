import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status-codes";
import { ContactService } from "./contact.service";

const createContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.createContact(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Contact created successfully",
    data: result,
  });
});

const getAllContacts = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.getAllContacts({
    query: req.query as Record<string, string>,
    user: {
      userId: (req.user as any).userId,
      role: (req.user as any).role,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contacts retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getSingleContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.getSingleContact(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact retrieved successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.markAsRead(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Marked as read",
    data: result,
  });
});

const markAsReplied = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.markAsReplied(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Marked as replied",
    data: result,
  });
});

const softDeleteContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.softDeleteContact(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact deleted successfully",
    data: result,
  });
});

const deleteContact = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactService.deleteContact(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact deleted successfully",
    data: result,
  });
});

const getAllTrashContacts = catchAsync(async (req, res) => {
  const result = await ContactService.getAllTrashContacts({
    query: req.query as Record<string, string>,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trash contacts retrieved successfully",
    data: result?.data,
  });
});
// RESTORE CONTACT
const restoreContact = async (req: Request, res: Response) => {
  const result = await ContactService.restoreContact(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message restored successfully",
    data: result,
  });
};

export const ContactController = {
  createContact,
  getAllContacts,
  getSingleContact,
  markAsRead,
  markAsReplied,
  softDeleteContact,

  deleteContact,
  getAllTrashContacts,
  restoreContact
};