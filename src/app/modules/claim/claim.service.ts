
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Claim } from "./claim.model";
import {
  IClaim,
  ClaimStatus,
  DocumentSubmissionAction,
  PaymentMethod,
} from "./claim.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { claimSearchableFields } from "./claim.constants";
import { Role } from "../user/user.interface";
import { Subscription } from "../subscription/subscription.model";
import { Notification } from "../notification/notification.model";
import { NotificationType } from "../notification/notification.interface";
import { Types } from "mongoose";
import { User } from "../user/user.model";

// DATE FILTER HELPERS
// startDate only  → exact day match on createdAt
// endDate only    → exact day match on createdAt
// both provided   → inclusive range

const getDayBoundariesUTC = (dateStr: string) => {
  const d = new Date(dateStr);

  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );

  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );

  return { start, end };
};

const buildDateFilter = (
  startDateStr: string | undefined,
  endDateStr: string | undefined,
): Record<string, { $gte?: Date; $lte?: Date }> => {
  if (!startDateStr && !endDateStr) return {};

  if (startDateStr && endDateStr) {
    return {
      createdAt: {
        $gte: getDayBoundariesUTC(startDateStr).start,
        $lte: getDayBoundariesUTC(endDateStr).end,
      },
    };
  }

  if (startDateStr) {
    const { start, end } = getDayBoundariesUTC(startDateStr);
    return { createdAt: { $gte: start, $lte: end } };
  }

  const { start, end } = getDayBoundariesUTC(endDateStr!);
  return { createdAt: { $gte: start, $lte: end } };
};

// CREATE CLAIM

// Keep only the fields relevant to the chosen payment method, so switching
// from BANK to bKash/Nagad doesn't leave stale bank details behind.
const normalizePaymentInfo = (
  method: PaymentMethod,
  info?: Record<string, any> | null,
): Record<string, any> => {
  const src = info ?? {};

  if (method === PaymentMethod.BKASH || method === PaymentMethod.NAGAD) {
    return { mobileNumber: src.mobileNumber };
  }

  if (method === PaymentMethod.BANK) {
    return {
      bankName: src.bankName,
      accountName: src.accountName,
      accountNumber: src.accountNumber,
      routingNumber: src.routingNumber,
      branchName: src.branchName,
    };
  }

  return {};
};

const createClaim = async (payload: Record<string, any>, userId: string) => {
  const subscription = await Subscription.findById(payload.subscription);

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  const documents: string[] = payload.attachments ?? [];

  return await Claim.create({
    ...payload,
    paymentInfo: normalizePaymentInfo(payload.paymentMethod, payload.paymentInfo),
    status: ClaimStatus.PENDING,
    documentSubmissions: documents.length
      ? [
          {
            submittedAt: new Date(),
            submittedBy: userId,
            action: DocumentSubmissionAction.CREATED,
            documents,
          },
        ]
      : [],
  });
};

// GET ALL CLAIMS

const getAllClaims = async ({
  query,
  user,
}: {
  query: Record<string, string>;
  user: { userId: string; role: string };
}) => {
  const isAdminLevel =
    user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || user.role === Role.CLAIMS_MANAGER;

  // Capture before deletion so stats can reuse the same range
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  // ─── BASE FILTER ──────────────────────────────────
  const baseFilter: any = {
    isDeleted: false,
    ...dateFilter,
  };

  const searchTerm = query.searchTerm;

  if (searchTerm) {
    const users = await User.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
      ],
    }).select("_id");

    const customerIds = users.map((user) => user._id);

    baseFilter.$or = [
      { claimTitle: { $regex: searchTerm, $options: "i" } },
      { description: { $regex: searchTerm, $options: "i" } },
      { adminNote: { $regex: searchTerm, $options: "i" } },
      { status: { $regex: searchTerm, $options: "i" } },
      { customer: { $in: customerIds } },
    ];

    delete query.searchTerm;
  }

  // Non-admin only sees their own claims
  if (!isAdminLevel) {
    baseFilter.customer = user.userId;
  }

  // status filter — remove from query so QueryBuilder doesn't double-apply
  if (query.status) {
    baseFilter.status = query.status;
    delete query.status;
  }

  // ─── DATA QUERY ───────────────────────────────────
  const queryBuilder = new QueryBuilder(Claim.find(baseFilter), query);

  const data = await queryBuilder
    .search(claimSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone role")
    .populate({
      path: "subscription",
      populate: { path: "package", select: "name title" },
    })
    .populate("reviewedBy", "name phone role")
    .populate("documentSubmissions.submittedBy", "name role");

  const meta = await queryBuilder.getMeta();

  // ─── STATS ────────────────────────────────────────
  // Stats always show the full breakdown for the date range regardless
  // of the status filter applied to data, so the admin/user can see the
  // complete picture even when filtering by a single status.
  const statsMatch: any = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  if (!isAdminLevel) {
    statsMatch.customer = new Types.ObjectId(user.userId);
  }

  const statsAgg = await Claim.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.PENDING] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.APPROVED] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.REJECTED] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const stats = statsAgg[0] || {
    total: 0, pending: 0, approved: 0, rejected: 0,
  };

  return { data, meta, stats };
};

const getClaimStats = async (match: Record<string, any>) => {
  const agg = await Claim.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.PENDING] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.APPROVED] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", ClaimStatus.REJECTED] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        pending: 1,
        approved: 1,
        rejected: 1,
      },
    },
  ]);

  return agg[0] || { total: 0, pending: 0, approved: 0, rejected: 0 };
};

const getAllTrashClaims = async ({
  query,
  user,
}: {
  query: Record<string, string>;
  user: { userId: string; role: string };
}) => {
  const baseQuery = Claim.find({
    isDeleted: true,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const claims = await queryBuilder
    .filter()
    .search(claimSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  const stats = await getClaimStats({ isDeleted: true });

  return { data: claims, meta, stats };
};

const getSingleClaim = async (id: string) => {
  const claim = await Claim.findById(id)
    .populate("customer", "name phone role")
    .populate("subscription")
    .populate("reviewedBy", "name phone role")
    .populate("documentSubmissions.submittedBy", "name role");

  if (!claim) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  return claim;
};

// UPDATE CLAIM
// Uploaded documents are appended (never replaced) and recorded as a dated
// submission entry, so the full document history stays available.
const updateClaim = async (
  id: string,
  payload: Partial<IClaim>,
  userId: string,
) => {
  const claim = await Claim.findById(id);

  if (!claim) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  if (claim.status === ClaimStatus.APPROVED) {
    throw new AppError(httpStatus.BAD_REQUEST, "Approved claim cannot be updated");
  }

  // If previously rejected and customer re-submits, reset back to pending
  if (claim.status === ClaimStatus.REJECTED) {
    payload.status = ClaimStatus.PENDING;
    payload.adminNote = "";
    payload.reviewedBy = undefined;
    payload.reviewedAt = undefined;
  }

  const { attachments: newDocuments = [], ...fields } = payload;

  if (fields.paymentInfo !== undefined || fields.paymentMethod) {
    fields.paymentInfo = normalizePaymentInfo(
      (fields.paymentMethod ?? claim.paymentMethod) as PaymentMethod,
      (fields.paymentInfo ?? claim.paymentInfo) as unknown as Record<string, any>,
    ) as any;
  }

  const update: Record<string, any> = { $set: fields };

  if (newDocuments.length) {
    update.$push = {
      attachments: { $each: newDocuments },
      documentSubmissions: {
        submittedAt: new Date(),
        submittedBy: userId,
        action: DocumentSubmissionAction.UPDATED,
        documents: newDocuments,
      },
    };
  }

  return await Claim.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    runValidators: true,
  });
};

// REVIEW CLAIM
// Sends a notification to the customer after review.

const reviewClaim = async (
  id: string,
  payload: { status: ClaimStatus; adminNote?: string },
  adminId: string,
) => {
  const claim = await Claim.findById(id).populate("customer", "_id name");

  if (!claim) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  const updated = await Claim.findByIdAndUpdate(
    id,
    {
      status: payload.status,
      adminNote: payload.adminNote,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
    { runValidators: true, returnDocument: "after" },
  );

  // ─── NOTIFICATION ─────────────────────────────────
  const customer = claim.customer as any;

  const isApproved = payload.status === ClaimStatus.APPROVED;

  const notificationTitle = isApproved
    ? "Claim Approved"
    : "Claim Rejected";

  const notificationMessage = isApproved
    ? `Your ${claim.claimTitle} claim has been approved.${payload.adminNote ? ` Note: ${payload.adminNote}` : ""}`
    : `Your ${claim.claimTitle} claim has been rejected.${payload.adminNote ? ` Reason: ${payload.adminNote}` : ""}`;

  await Notification.create({
    user: customer._id,
    title: notificationTitle,
    message: notificationMessage,
    type: NotificationType.CLAIM,
  });

  return updated;
};

// SOFT DELETE CLAIM

const softDeleteClaim = async (id: string) => {
  const claim = await Claim.findById(id);

  if (!claim) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  return await Claim.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

// RESTORE CLAIM
const restoreClaim = async (id: string) => {
  const existing = await Claim.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  return await Claim.findByIdAndUpdate(id, { isDeleted: false }, { returnDocument: "after" });
};


//Hard delete
const deleteClaim = async (id: string) => {
  const existing = await Claim.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Claim not found");
  }

  await Claim.findByIdAndDelete(id);

  return null;
};


export const ClaimService = {
  createClaim,
  getAllClaims,
  getSingleClaim,
  updateClaim,
  reviewClaim,
  softDeleteClaim,
  getAllTrashClaims,
  deleteClaim,
  restoreClaim,
};