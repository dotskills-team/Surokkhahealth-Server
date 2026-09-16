// Backend notification interface 
import { Types } from "mongoose";

export enum NotificationType {
  SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  SUBSCRIPTION_EXPIRING = "SUBSCRIPTION_EXPIRING",
  SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED",
  GENERAL = "GENERAL",
  CLAIM = "CLAIM",
}

export interface INotification {
  _id?: Types.ObjectId;

  user: Types.ObjectId;

  title: string;
  message: string;

  type?: NotificationType;

  isRead: boolean;
  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}