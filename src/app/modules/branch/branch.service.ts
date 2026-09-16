// =============================================================
// PARTNER BRANCH SERVICES
// =============================================================

import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { IPartnerBranch } from "./branch.interface";
import { Partner } from "../partner/partner.model";
import { PartnerBranch } from "./branch.model";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { partnerBranchSearchableFields } from "./branch.constants";
import { Types } from "mongoose";

const PARTNER_PROJECTION = { name: 1, logo: 1, phone: 1, email: 1, website: 1 };

const runGeoNear = async (
  longitude: number,
  latitude: number,
  partnerIds: string[],
) => {
  return PartnerBranch.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        distanceField: "distanceMeters",
        spherical: true,
        query: {
          isDeleted: false,
          isActive: true,
          ...(partnerIds.length && {
            partner: {
              $in: partnerIds.map((id) => new Types.ObjectId(id)),
            },
          }),
        },
      },
    },
    {
      $lookup: {
        from: "partners",
        localField: "partner",
        foreignField: "_id",
        as: "partner",
        pipeline: [
          {
            $project: PARTNER_PROJECTION,
          },
        ],
      },
    },
    {
      $unwind: "$partner",
    },
    {
      $sort: {
        distanceMeters: 1,
      },
    },
  ]);
};

const withDistanceKm = (docs: any[]) =>
  docs.map((doc) => ({
    ...doc,
    distanceKm: Number((doc.distanceMeters / 1000).toFixed(2)),
  }));

const getDayBoundariesUTC = (dateStr: string) => {
  const d = new Date(dateStr);

  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );

  const end = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
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
  const endDateStr = query["endDate"];

  Object.assign(queryObj, buildDateFilter(startDateStr, endDateStr));

  if (query.isActive !== undefined)
    queryObj.isActive = query.isActive === "true";

  delete query.startDate;
  delete query.endDate;

  return { queryObj, startDateStr, endDateStr };
};

const createPartnerBranch = async (payload: Partial<IPartnerBranch>) => {
  const partnerExists = await Partner.findOne({
    _id: payload.partner,
    isDeleted: false,
  });

  if (!partnerExists) {
    throw new AppError(httpStatus.NOT_FOUND, "Partner not found");
  }

  const branchExists = await PartnerBranch.findOne({
    partner: payload.partner,
    branchName: payload.branchName,
    isDeleted: false,
  });

  if (branchExists) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Branch with this name already exists for this partner",
    );
  }

  return await PartnerBranch.create(payload);
};

const getAllPartnerBranches = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseFilter: any = { isDeleted: false, ...queryObj };

  if (query.partner) {
    baseFilter.partner = new Types.ObjectId(query.partner);
    delete query.partner;
  }

  const baseQuery = PartnerBranch.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(partnerBranchSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("partner", "name logo phone email category description");

  const meta = await queryBuilder.getMeta();

  // =============================================================
  // PARTNER BRANCH STATS
  // =============================================================

  const getPartnerBranchStats = async (match: Record<string, any>) => {
    const agg = await PartnerBranch.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },
        },
      },
    ]);

    return agg[0] || { total: 0, active: 0, inactive: 0 };
  };

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch: any = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  if (baseFilter.partner) {
    statsMatch.partner = baseFilter.partner;
  }

  const stats = await getPartnerBranchStats(statsMatch);

  return { data, meta, stats };
};

const getAllTrashPartnerBranches = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseFilter: any = { isDeleted: true, ...queryObj };

  if (query.partner) {
    baseFilter.partner = new Types.ObjectId(query.partner);
    delete query.partner;
  }

  const baseQuery = PartnerBranch.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(partnerBranchSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("partner", "name logo phone email category description");

  const meta = await queryBuilder.getMeta();

  // =============================================================
  // PARTNER BRANCH STATS
  // =============================================================

  const getPartnerBranchStats = async (match: Record<string, any>) => {
    const agg = await PartnerBranch.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },
        },
      },
    ]);

    return agg[0] || { total: 0, active: 0, inactive: 0 };
  };

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch: any = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  if (baseFilter.partner) {
    statsMatch.partner = baseFilter.partner;
  }

  const stats = await getPartnerBranchStats(statsMatch);

  return { data, meta, stats };
};

const getSinglePartnerBranch = async (id: string) => {
  const branch = await PartnerBranch.findById(id).populate(
    "partner",
    "name logo phone email website",
  );

  if (!branch) {
    throw new AppError(httpStatus.NOT_FOUND, "Partner branch not found");
  }

  return branch;
};

const updatePartnerBranch = async (
  id: string,
  payload: Partial<IPartnerBranch>,
) => {
  const branch = await PartnerBranch.findById(id);

  if (!branch) {
    throw new AppError(httpStatus.NOT_FOUND, "Partner branch not found");
  }

  return await PartnerBranch.findByIdAndUpdate(id, payload, {
    runValidators: true,
    returnDocument: "after",
  });
};

const softDeletePartnerBranch = async (id: string) => {
  const branch = await PartnerBranch.findById(id);

  if (!branch) {
    throw new AppError(httpStatus.NOT_FOUND, "Partner branch not found");
  }

  return await PartnerBranch.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

const deletePartnerBranch = async (id: string) => {
  await PartnerBranch.findByIdAndDelete(id);

  return null;
};

const restorePartnerBranch = async (id: string) => {
  const branch = await PartnerBranch.findById(id);

  if (!branch) {
    throw new AppError(httpStatus.NOT_FOUND, "Branch not found");
  }

  return await PartnerBranch.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { returnDocument: "after" },
  );
};

const getNearbyBranches = async ({
  latitude,
  longitude,
  partnerIds,
}: {
  latitude: number;
  longitude: number;
  partnerIds: string[];
}) => {
  const branches: any[] = await runGeoNear(longitude, latitude, partnerIds);

  return {
    data: withDistanceKm(branches),
    total: branches.length,
  };
};

export const BranchServices = {
  createPartnerBranch,
  getSinglePartnerBranch,
  getAllPartnerBranches,
  getAllTrashPartnerBranches,
  softDeletePartnerBranch,
  updatePartnerBranch,
  deletePartnerBranch,
  restorePartnerBranch,
  getNearbyBranches,
};
