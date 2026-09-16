import { Types } from "mongoose";

export interface IContact {
  _id?: Types.ObjectId;

  name: string;
  phone: string;
  email?: string;

  subject?: string;
  message: string;

  isRead: boolean;
  isReplied: boolean;
  isDeleted: boolean;

  userId?: Types.ObjectId;

  relatedPackage?: Types.ObjectId;
  relatedPartner?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}