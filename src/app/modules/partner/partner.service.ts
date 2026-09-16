
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Partner } from "./partner.model";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { Types } from "mongoose";
import { PartnerBranch } from "../branch/branch.model";
import { IPartner } from "./partner.interface";
import { partnerSearchableFields } from "./partner.constants";

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

const buildQueryObj = (query: Record<string, string>) => {
  const queryObj: any = {};

  const startDateStr = query["startDate"];
  const endDateStr   = query["endDate"];

  Object.assign(queryObj, buildDateFilter(startDateStr, endDateStr));

  if (query.isActive !== undefined) queryObj.isActive = query.isActive === "true";
  if (query.category !== undefined) queryObj.category = query.category;

  delete query.startDate;
  delete query.endDate;

  return { queryObj, startDateStr, endDateStr };
};


// =============================================================
// PARTNER STATS
// =============================================================

const getPartnerStats = async (match: Record<string, any>) => {
  const agg = await Partner.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total:              { $sum: 1 },
        active:             { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        inactive:           { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },
        diagnosticHospital: { $sum: { $cond: [{ $eq: ["$category", "DIAGNOSTIC_HOSPITAL"] }, 1, 0] } },
        pharmaceuticals:    { $sum: { $cond: [{ $eq: ["$category", "PHARMACEUTICALS"] }, 1, 0] } },
      },
    },
  ]);

  return agg[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    diagnosticHospital: 0,
    pharmaceuticals: 0,
  };
};

// PARTNER SERVICES

const createPartner = async (
  payload: Partial<IPartner>,
  userId: string,
) => {
  const exists = await Partner.findOne({
    name: payload.name,
    isDeleted: false,
  });

  if (exists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Partner already exists",
    );
  }

  return await Partner.create({
    ...payload,
    createdBy: new Types.ObjectId(userId),
  });
};

const getAllPartners = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Partner.find({
    isDeleted: false,
    ...queryObj,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(partnerSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // =========================
  // BRANCH COUNT PER PARTNER
  // =========================
  const partnerIds = data.map((p: any) => p._id);

  const branchCounts = await PartnerBranch.aggregate([
    { $match: { partner: { $in: partnerIds }, isDeleted: false } },
    { $group: { _id: "$partner", count: { $sum: 1 } } },
  ]);

  const branchCountMap = new Map(
    branchCounts.map((b) => [String(b._id), b.count]),
  );

  const dataWithBranchCount = data.map((p: any) => ({
    ...p.toObject(),
    branchCount: branchCountMap.get(String(p._id)) ?? 0,
  }));

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const stats = await getPartnerStats(statsMatch);

  return { data: dataWithBranchCount, meta, stats };
};


const getAllTrashPartners = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Partner.find({
    isDeleted: true,
    ...queryObj,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(partnerSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const stats = await getPartnerStats(statsMatch);

  return { data, meta, stats };
};

const getSinglePartner = async (id: string) => {
  const partner = await Partner.findById(id)
    .populate("createdBy", "name phone role");

  if (!partner) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Partner not found",
    );
  }

  return partner;
};

const updatePartner = async (
  id: string,
  payload: Partial<IPartner>,
) => {
  const partner = await Partner.findById(id);

  if (!partner) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Partner not found",
    );
  }

  return await Partner.findByIdAndUpdate(
    id,
    payload,
    { runValidators: true, returnDocument: "after" },
  );
};

const softDeletePartner = async (id: string) => {
  const partner = await Partner.findById(id);

  if (!partner) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Partner not found",
    );
  }

  // Partner delete হলে সব branch ও soft delete
  await PartnerBranch.updateMany(
    { partner: id, isDeleted: false },
    { isDeleted: true },
  );

  return await Partner.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

const deletePartner = async (id: string) => {
   await Partner.findByIdAndDelete(id);

  return null
};

const restorePartner = async (id: string) => {
  const partner = await Partner.findById(id);

  if (!partner) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Partner not found",
    );
  }

  return await Partner.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { returnDocument: "after" },
  );
};

export const PartnerServices = {
  createPartner,
  getAllPartners,
  getSinglePartner,
  updatePartner,
  softDeletePartner,
  getAllTrashPartners,
  deletePartner,  
  restorePartner,
};