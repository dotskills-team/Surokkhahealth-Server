import { Types } from "mongoose";

export interface IPartnerBranch {
  _id?: Types.ObjectId;

  partner: Types.ObjectId;

  branchName: string;

  phone?: string;

  email?: string;

  address: string;

  city?: string;

  area?: string;

  postalCode?: string;

  location: {
    type: "Point";
    coordinates: [number, number];
  };

  isActive: boolean;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}