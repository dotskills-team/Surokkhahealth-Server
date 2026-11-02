import { Types } from "mongoose";

export enum ClaimStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ClaimTitle {
  OPD = "OPD",
  HOSPITAL_COVERAGE = "HOSPITAL_COVERAGE",
  PREGNANCY_COVERAGE = "PREGNANCY_COVERAGE",
  PARTIAL_DISABILITY = "PARTIAL_DISABILITY",
  PERMANENT_DISABILITY = "PERMANENT_DISABILITY",
  LIFE_COVERAGE = "LIFE_COVERAGE",
}

export enum PaymentMethod {
  BKASH = "BKASH",
  NAGAD = "NAGAD",
  BANK = "BANK",
}

export enum DocumentSubmissionAction {
  CREATED = "CREATED",
  UPDATED = "UPDATED",
}

// One entry per upload event (initial submission or a later update).
// Previous uploads are kept, never replaced.
export interface IDocumentSubmission {
  submittedAt: Date;
  submittedBy?: Types.ObjectId;
  action: DocumentSubmissionAction;
  documents: string[];
}

export interface IClaim {
  _id?: Types.ObjectId;

  customer: Types.ObjectId;
  paymentInfo: {
    mobileNumber: string;

    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    branchName: string;
  };
  claimTitle: ClaimTitle;

  subscription: Types.ObjectId;

  paymentMethod: PaymentMethod;

  description: string;

  // Flat list of every document ever submitted for this claim (all uploads).
  attachments?: string[];

  // Date-wise history of document submissions.
  documentSubmissions?: IDocumentSubmission[];

  status: ClaimStatus;

  adminNote?: string;

  reviewedBy?: Types.ObjectId;

  reviewedAt?: Date;

  isDeleted: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

