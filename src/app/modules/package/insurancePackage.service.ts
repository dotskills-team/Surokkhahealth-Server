
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { InsurancePackage } from "./insurancePackage.model";
import { Subscription } from "../subscription/subscription.model";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { packageSearchableFields } from "./insurancePackage.constants";
import { Types } from "mongoose";
import { IInsurancePackage } from "./insurance-package.interface";

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

  delete query.startDate;
  delete query.endDate;

  return { queryObj, startDateStr, endDateStr };
};

const getPackageStats = async (match: Record<string, any>) => {
  const agg = await InsurancePackage.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "package",
        as: "subscriptions",
        pipeline: [
          { $match: { isDeleted: false } },
        ],
      },
    },

    {
      $group: {
        _id: null,

        total:    { $sum: 1 },
        active:   { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },

        totalCoverage: { $sum: "$coverageAmount" },
        avgCoverage:   { $avg: "$coverageAmount" },
        totalRevenue: {
          $sum: {
            $reduce: {
              input: "$subscriptions",
              initialValue: 0,
              in: {
                $add: [
                  "$$value",
                  {
                    $cond: [
                      { $eq: ["$$this.paymentStatus", "PAID"] },
                      "$$this.price",
                      0,
                    ],
                  },
                ],
              },
            },
          },
        },

        totalSubscriptions: { $sum: { $size: "$subscriptions" } },
      },
    },

    {
      $project: {
        _id: 0,
        total: 1,
        active: 1,
        inactive: 1,
        totalCoverage: 1,
        avgCoverage:        { $round: ["$avgCoverage", 2] },
        totalRevenue: 1,
        totalSubscriptions: 1,
      },
    },
  ]);

  return agg[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    totalCoverage: 0,
    avgCoverage: 0,
    totalRevenue: 0,
    totalSubscriptions: 0,
  };
};

const attachPackageAnalytics = async (packageIds: Types.ObjectId[]) => {
  const agg = await Subscription.aggregate([
    {
      $match: {
        package: { $in: packageIds },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$package",

        totalSubscriptions: { $sum: 1 },

        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$price", 0],
          },
        },

        active: {
          $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
        },

        pending: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
        },
      },
    },
  ]);

  // packageId → analytics map 
  return agg.reduce<Record<string, any>>((map, item) => {
    map[item._id.toString()] = {
      totalSubscriptions: item.totalSubscriptions,
      totalRevenue:       item.totalRevenue,
      activeSubscriptions: item.active,
      pendingSubscriptions: item.pending,
    };
    return map;
  }, {});
};

const createPackage = async (payload: IInsurancePackage) => {
  const existing = await InsurancePackage.findOne({
    name: payload.name,
  });

  if (existing) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Package already exists",
    );
  }

  return await InsurancePackage.create(payload);
};

const getAllPackages = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = InsurancePackage.find({
    isDeleted: false,
    ...queryObj,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const packages = await queryBuilder
    .filter()
    .search(packageSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  // =========================
  // PER-PACKAGE ANALYTICS
  // প্রতিটা package row এ revenue + subscription count attach
  // =========================
  const packageIds = packages.map((p: any) => p._id);
  const analyticsMap = await attachPackageAnalytics(packageIds);

  const data = packages.map((p: any) => {
    const pkg = p.toObject ? p.toObject() : p;
    const analytics = analyticsMap[pkg._id.toString()] || {
      totalSubscriptions:  0,
      totalRevenue:        0,
      activeSubscriptions: 0,
      pendingSubscriptions: 0,
    };
    return { ...pkg, analytics };
  });

  // =========================
  // OVERALL STATS
  // =========================
  const statsMatch = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const stats = await getPackageStats(statsMatch);

  return { data, meta, stats };
};

const getAllTrashPackages = async (query: Record<string, string>) => {
  const { queryObj, startDateStr, endDateStr } = buildQueryObj(query);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = InsurancePackage.find({
    isDeleted: true,
    ...queryObj,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(packageSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = {
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const stats = await getPackageStats(statsMatch);

  return { data, meta, stats };
};

const getSinglePackage = async (id: string) => {
  const pkg = await InsurancePackage.findById(id);

  if (!pkg) {
    throw new AppError(httpStatus.NOT_FOUND, "Package not found");
  }

  const packageObjectId = new Types.ObjectId(id);

  const agg = await Subscription.aggregate([
    {
      $match: {
        package: packageObjectId,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        totalSubscriptions: { $sum: 1 },
        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$price", 0],
          },
        },
        active:    { $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] } },
        pending:   { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        expired:   { $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
        paid:      { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] } },
        unpaid:    { $sum: { $cond: [{ $eq: ["$paymentStatus", "UNPAID"] }, 1, 0] } },
        refunded:  { $sum: { $cond: [{ $eq: ["$paymentStatus", "REFUNDED"] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalSubscriptions: 1,
        totalRevenue: 1,
        subscriptionBreakdown: {
          active: "$active", pending: "$pending",
          expired: "$expired", cancelled: "$cancelled",
        },
        paymentBreakdown: {
          paid: "$paid", unpaid: "$unpaid", refunded: "$refunded",
        },
      },
    },
  ]);

  const analytics = agg[0] || {
    totalSubscriptions: 0,
    totalRevenue: 0,
    subscriptionBreakdown: { active: 0, pending: 0, expired: 0, cancelled: 0 },
    paymentBreakdown: { paid: 0, unpaid: 0, refunded: 0 },
  };

  return { package: pkg, analytics };
};

const updatePackage = async (
  id: string,
  payload: Partial<IInsurancePackage>,
) => {
  const existing = await InsurancePackage.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Package not found");
  }

  return await InsurancePackage.findByIdAndUpdate(
    id,
    payload,
    {  runValidators: true, returnDocument: "after" },
  );
};

const softDeletePackage = async (id: string) => {
  const existing = await InsurancePackage.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Package not found");
  }

  return await InsurancePackage.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

const deletePackage = async (id: string) => {
  const existing = await InsurancePackage.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Package not found");
  }

  await InsurancePackage.findByIdAndDelete(id);

  return null;
};

export const PackageServices = {
  createPackage,
  getAllPackages,
  getAllTrashPackages,
  getSinglePackage,
  updatePackage,
  softDeletePackage,
  deletePackage,
};