import { Types } from "mongoose";

export enum PartnerCategory {
  DIAGNOSTIC_HOSPITAL = "DIAGNOSTIC_HOSPITAL",
  PHARMACEUTICALS = "PHARMACEUTICALS"
}

export interface IPartner {
  _id?: Types.ObjectId;

  name: string;

  logo?: string;
  category?: PartnerCategory;

  description?: string;

  phone?: string;

  email?: string;

  website?: string;

  isActive: boolean;

  isDeleted: boolean;

  createdBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}