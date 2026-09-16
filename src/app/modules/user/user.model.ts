
import { model, Schema } from "mongoose";
import { IsActive, IUser, Role } from "./user.interface";

// ADDRESS SUB-SCHEMA
const addressSchema = new Schema(
  {
    division: { type: String },
    district: { type: String },
    thana: { type: String },
    street: { type: String },
  },
  { _id: false },
);

// NOMINEE SUB-SCHEMA
const nomineeSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String },
  },
  { _id: false },
);

// USER SCHEMA
const userSchema = new Schema<IUser>(
  {
    // BASIC INFO
    name: {
      type: String,
      required: true,
      trim: true,
    },

    customId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      select: false,
    },

    picture: {
      type: String,
      default: "",
    },

    // ROLE SYSTEM
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.CUSTOMER,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    agentLeader: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // CUSTOMER INFO 
    nid: {
      type: String,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
    },

    address: {
      type: addressSchema,
    },

    // NOMINEE INFO
    nominee: {
      type: nomineeSchema,
    },

    // SYSTEM FLAGS
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    isActive: {
      type: String,
      enum: Object.values(IsActive),
      default: IsActive.ACTIVE,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const User = model<IUser>("User", userSchema);