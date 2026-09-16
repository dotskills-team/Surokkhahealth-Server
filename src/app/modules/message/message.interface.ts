import { Types } from "mongoose";

export enum MessageType {
  SUBSCRIPTION = "SUBSCRIPTION",
  PAYMENT = "PAYMENT",
  CLAIM = "CLAIM",
  PROMOTIONAL = "PROMOTIONAL",
  GENERAL = "GENERAL",
  OTP = "OTP",

}

export interface IMessage {
  _id?: Types.ObjectId;

  message: string;
  phone: string;

  type?: MessageType;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}