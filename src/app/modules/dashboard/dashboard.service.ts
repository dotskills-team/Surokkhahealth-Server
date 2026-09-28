
import { Types } from "mongoose";
import httpStatus from "http-status-codes";

import { Subscription } from "../subscription/subscription.model";
import { User } from "../user/user.model";

import {
  PaymentStatus,
  SubscriptionStatus,
} from "../subscription/subscription.interface";

import { Role } from "../user/user.interface";

import {
  IDashboardSummary,
  IDashboardOverview,
  IDashboardOverviewCard,
  IDashboardPackageRevenue,
  IDashboardResponse,
  IRecentSubscription,
  IRecentCustomer,
} from "./dashboard.interface";
import AppError from "../../errorHelpers/appError";
import { InsurancePackage } from "../package/insurancePackage.model";
import { Partner } from "../partner/partner.model";
import { PartnerBranch } from "../branch/branch.model";

const getDateRanges = () => {
  const now = new Date();

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const endMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return {
    startToday,
    endToday,
    startMonth,
    endMonth,
  };
};

const buildMatch = (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
) => {
  const match: Record<string, any> = {
    isDeleted: false,
    paymentStatus: PaymentStatus.COMPLETED,
  };

  if (creatorIds?.length) {
    match.createdBy = {
      $in: creatorIds,
    };
  }

  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return match;
};

const getDashboardSummary = async (
  creatorIds?: Types.ObjectId[],
): Promise<IDashboardSummary> => {
  const subscriptionMatch = buildMatch(creatorIds);

  const customerMatch: Record<string, any> = {
    role: Role.CUSTOMER,
    isDeleted: false,
  };

  if (creatorIds?.length) {
    customerMatch.createdBy = {
      $in: creatorIds,
    };
  }

  const [
    subscriptionAgg,
    customerCount,
    packageCount,
    agentCount,
    agentLeaderCount,
  ] = await Promise.all([
    Subscription.aggregate([
      {
        $match: subscriptionMatch,
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: "$price",
          },

          totalSubscriptions: {
            $sum: 1,
          },

          activeSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.ACTIVE],
                },
                1,
                0,
              ],
            },
          },

          pendingSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.PENDING],
                },
                1,
                0,
              ],
            },
          },

          expiredSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.EXPIRED],
                },
                1,
                0,
              ],
            },
          },

          cancelledSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.CANCELLED],
                },
                1,
                0,
              ],
            },
          },

          paidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                1,
                0,
              ],
            },
          },

          unpaidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.UNPAID],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    User.countDocuments(customerMatch),

    InsurancePackage.countDocuments({
      isDeleted: false,
    }),

    User.countDocuments({
      role: Role.AGENT,
      isDeleted: false,
    }),

    User.countDocuments({
      role: Role.AGENT_LEADER,
      isDeleted: false,
    }),
  ]);

  const summary = subscriptionAgg[0];

  const totalRevenue = summary?.totalRevenue ?? 0;

  const totalSubscriptions = summary?.totalSubscriptions ?? 0;

  return {
    totalRevenue,

    totalSubscriptions,

    totalCustomers: customerCount,

    activeSubscriptions: summary?.activeSubscriptions ?? 0,

    pendingSubscriptions: summary?.pendingSubscriptions ?? 0,

    expiredSubscriptions: summary?.expiredSubscriptions ?? 0,

    cancelledSubscriptions: summary?.cancelledSubscriptions ?? 0,

    paidSubscriptions: summary?.paidSubscriptions ?? 0,

    unpaidSubscriptions: summary?.unpaidSubscriptions ?? 0,

    totalPackages: packageCount,

    totalAgents: agentCount,

    totalAgentLeaders: agentLeaderCount,

    averageRevenue:
      totalSubscriptions === 0
        ? 0
        : Number((totalRevenue / totalSubscriptions).toFixed(2)),
  };
};

// ── UPDATED ──
// Added optional startDate/endDate — customer dashboard passes current month.
const getCustomerSummary = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
): Promise<IDashboardSummary> => {
  const customerSubMatch: Record<string, any> = {
    customer: customerId,
    isDeleted: false,
  };

  if (startDate && endDate) {
    customerSubMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const [subscriptionAgg] = await Promise.all([
    Subscription.aggregate([
      {
        $match: customerSubMatch,
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                "$price",
                0,
              ],
            },
          },

          totalSubscriptions: {
            $sum: 1,
          },

          activeSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.ACTIVE],
                },
                1,
                0,
              ],
            },
          },

          pendingSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.PENDING],
                },
                1,
                0,
              ],
            },
          },

          expiredSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.EXPIRED],
                },
                1,
                0,
              ],
            },
          },

          cancelledSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.CANCELLED],
                },
                1,
                0,
              ],
            },
          },

          paidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                1,
                0,
              ],
            },
          },

          unpaidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.UNPAID],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const summary = subscriptionAgg[0];

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalSubscriptions = summary?.totalSubscriptions ?? 0;

  return {
    totalRevenue,
    totalSubscriptions,

    totalCustomers: 1,

    totalPackages: 0,

    totalAgents: 0,

    totalAgentLeaders: 0,

    activeSubscriptions: summary?.activeSubscriptions ?? 0,

    pendingSubscriptions: summary?.pendingSubscriptions ?? 0,

    expiredSubscriptions: summary?.expiredSubscriptions ?? 0,

    cancelledSubscriptions: summary?.cancelledSubscriptions ?? 0,

    paidSubscriptions: summary?.paidSubscriptions ?? 0,

    unpaidSubscriptions: summary?.unpaidSubscriptions ?? 0,

    averageRevenue:
      totalSubscriptions === 0
        ? 0
        : Number((totalRevenue / totalSubscriptions).toFixed(2)),
  };
};

const buildCustomerMatch = (
  customerId: Types.ObjectId | Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
) => {
  const match: Record<string, any> = {
    isDeleted: false,
  };

  if (Array.isArray(customerId)) {
    if (customerId.length) {
      match.customer = { $in: customerId };
    }
  } else if (customerId) {
    match.customer = customerId;
  }

  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return match;
};

// ── UPDATED ──
// Added optional `restrictLifetimeTo`. When provided (customer dashboard),
// the "lifetime" card is capped to that range instead of all-time data.
const generateCustomerOverview = async (
  customerId: Types.ObjectId,
  restrictLifetimeTo?: { start: Date; end: Date },
): Promise<IDashboardOverview> => {
  const { startToday, endToday, startMonth, endMonth } = getDateRanges();

  const [today, month, lifetime] = await Promise.all([
    getOverviewCard(buildCustomerMatch(customerId, startToday, endToday)),

    getOverviewCard(buildCustomerMatch(customerId, startMonth, endMonth)),

    restrictLifetimeTo
      ? getOverviewCard(
          buildCustomerMatch(
            customerId,
            restrictLifetimeTo.start,
            restrictLifetimeTo.end,
          ),
        )
      : getOverviewCard(buildCustomerMatch(customerId)),
  ]);

  return {
    today,
    month,
    lifetime,
  };
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getCustomerTopPackages = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
) => {
  const match: Record<string, any> = {
    customer: customerId,
    isDeleted: false,
  };

  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return Subscription.aggregate([
    {
      $match: match,
    },

    {
      $lookup: {
        from: "insurancepackages",
        localField: "package",
        foreignField: "_id",
        as: "package",
      },
    },

    {
      $unwind: "$package",
    },

    {
      $group: {
        _id: "$package._id",

        packageName: {
          $first: "$package.name",
        },

        subscriptions: {
          $sum: 1,
        },

        totalRevenue: {
          $sum: "$price",
        },
      },
    },

    {
      $project: {
        _id: 0,

        packageId: "$_id",

        packageName: 1,

        subscriptions: 1,

        totalRevenue: 1,

        averageRevenue: {
          $divide: ["$totalRevenue", "$subscriptions"],
        },
      },
    },

    {
      $sort: {
        totalRevenue: -1,
      },
    },
  ]);
};

const getOverviewCard = async (
  match: Record<string, any>,
): Promise<IDashboardOverviewCard> => {
  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $lookup: {
        from: "insurancepackages",
        localField: "package",
        foreignField: "_id",
        as: "package",
      },
    },

    {
      $unwind: "$package",
    },

    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,

              subscriptions: {
                $sum: 1,
              },

              revenue: {
                $sum: "$price",
              },
            },
          },
        ],

        packageWiseRevenue: [
          {
            $group: {
              _id: "$package._id",

              packageName: {
                $first: "$package.name",
              },

              subscriptions: {
                $sum: 1,
              },

              totalRevenue: {
                $sum: "$price",
              },
            },
          },

          {
            $project: {
              _id: 0,

              packageId: "$_id",

              packageName: 1,

              subscriptions: 1,

              totalRevenue: 1,

              averageRevenue: {
                $cond: [
                  {
                    $eq: ["$subscriptions", 0],
                  },
                  0,
                  {
                    $divide: ["$totalRevenue", "$subscriptions"],
                  },
                ],
              },
            },
          },

          {
            $sort: {
              totalRevenue: -1,
            },
          },
        ],
      },
    },
  ]);

  const summary = result[0]?.summary?.[0];

  return {
    subscriptions: summary?.subscriptions ?? 0,

    revenue: summary?.revenue ?? 0,

    averageRevenue: summary?.subscriptions
      ? Number((summary.revenue / summary.subscriptions).toFixed(2))
      : 0,

    packageWiseRevenue: result[0]?.packageWiseRevenue ?? [],
  };
};

// ── UPDATED ──
// Added optional `restrictLifetimeTo`. When provided (agent / agent leader
// dashboards), the "lifetime" card is capped to that range instead of
// showing true all-time data. Admin / super admin dashboard doesn't pass
// this, so its "lifetime" card is unaffected.
const generateOverview = async (
  creatorIds?: Types.ObjectId[],
  restrictLifetimeTo?: { start: Date; end: Date },
): Promise<IDashboardOverview> => {
  const { startToday, endToday, startMonth, endMonth } = getDateRanges();

  const [today, month, lifetime] = await Promise.all([
    getOverviewCard(buildMatch(creatorIds, startToday, endToday)),

    getOverviewCard(buildMatch(creatorIds, startMonth, endMonth)),

    restrictLifetimeTo
      ? getOverviewCard(
          buildMatch(creatorIds, restrictLifetimeTo.start, restrictLifetimeTo.end),
        )
      : getOverviewCard(buildMatch(creatorIds)),
  ]);

  return {
    today,
    month,
    lifetime,
  };
};

// ── UPDATED ──
// Added optional startDate/endDate. Admin dashboard calls this with no
// dates (unrestricted); all other dashboards pass current month.
const getRecentSubscriptions = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IRecentSubscription[]> => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (creatorIds?.length) {
    filter.createdBy = {
      $in: creatorIds,
    };
  }

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const subscriptions = await Subscription.find(filter)
    .populate("customer", "name phone picture")
    .populate("package", "name")
    .populate("createdBy", "name role")
    .sort({
      createdAt: -1,
    })
    .limit(10)
    .lean();

  return subscriptions.map((subscription: any) => ({
    _id: subscription._id.toString(),

    customerName: subscription.customer?.name ?? "",

    customerPhone: subscription.customer?.phone ?? "",

    customerPicture: subscription.customer?.picture ?? "",

    packageName: subscription.package?.name ?? "",

    amount: subscription.price,

    paymentStatus: subscription.paymentStatus,

    subscriptionStatus: subscription.status,

    agentName: subscription.createdBy?.name ?? "",

    agentRole: subscription.createdBy?.role ?? "",

    createdAt: subscription.createdAt,
  }));
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getRecentSubscriptionsByCustomer = async (
  customerId?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IRecentSubscription[]> => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (customerId?.length) {
    filter.customer = {
      $in: customerId,
    };
  }

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const subscriptions = await Subscription.find(filter)
    .populate("customer", "name phone picture")
    .populate("package", "name")
    .populate("createdBy", "name role")
    .sort({
      createdAt: -1,
    })
    .limit(10)
    .lean();

  return subscriptions.map((subscription: any) => ({
    _id: subscription._id.toString(),

    customerName: subscription.customer?.name ?? "",

    customerPhone: subscription.customer?.phone ?? "",

    customerPicture: subscription.customer?.picture ?? "",

    packageName: subscription.package?.name ?? "",

    amount: subscription.price,

    paymentStatus: subscription.paymentStatus,

    subscriptionStatus: subscription.status,

    agentName: subscription.customer?.name ?? "",

    agentRole: subscription.customer?.role ?? "",

    createdAt: subscription.createdAt,
  }));
};

const getCustomerRecentCustomers = async () => [];

// ── UPDATED ──
// Added optional startDate/endDate.
const getRecentCustomers = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IRecentCustomer[]> => {
  const filter: Record<string, any> = {
    role: Role.CUSTOMER,
    isDeleted: false,
  };

  if (creatorIds?.length) {
    filter.createdBy = {
      $in: creatorIds,
    };
  }

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const customers = await User.find(filter)
    .populate("createdBy", "name role")
    .select("name phone picture createdBy createdAt")
    .sort({
      createdAt: -1,
    })
    .limit(10)
    .lean();

  const customerIds = customers.map((customer: any) => customer._id);

  const analytics = await Subscription.aggregate([
    {
      $match: {
        customer: {
          $in: customerIds,
        },
        isDeleted: false,

        ...(creatorIds?.length && {
          createdBy: {
            $in: creatorIds,
          },
        }),
      },
    },

    {
      $group: {
        _id: "$customer",

        totalSubscriptions: {
          $sum: 1,
        },

        totalSpent: {
          $sum: "$price",
        },
      },
    },
  ]);

  const analyticsMap = analytics.reduce<Record<string, any>>((acc, item) => {
    acc[item._id.toString()] = {
      totalSubscriptions: item.totalSubscriptions,

      totalSpent: item.totalSpent,
    };

    return acc;
  }, {});

  return customers.map((customer: any) => {
    const customerAnalytics = analyticsMap[customer._id.toString()] ?? {
      totalSubscriptions: 0,
      totalSpent: 0,
    };

    return {
      _id: customer._id.toString(),

      name: customer.name,

      phone: customer.phone,

      picture: customer.picture,

      createdBy: customer.createdBy?.name ?? "",

      createdByRole: customer.createdBy?.role ?? "",

      createdAt: customer.createdAt,

      totalSubscriptions: customerAnalytics.totalSubscriptions,

      totalSpent: customerAnalytics.totalSpent,
    };
  });
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getTopPackages = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IDashboardPackageRevenue[]> => {
  const match = buildMatch(creatorIds, startDate, endDate);

  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $lookup: {
        from: "insurancepackages",
        localField: "package",
        foreignField: "_id",
        as: "package",
      },
    },

    {
      $unwind: "$package",
    },

    {
      $group: {
        _id: "$package._id",

        packageName: {
          $first: "$package.name",
        },

        subscriptions: {
          $sum: 1,
        },

        totalRevenue: {
          $sum: "$price",
        },
      },
    },

    {
      $project: {
        _id: 0,

        packageId: "$_id",

        packageName: 1,

        subscriptions: 1,

        totalRevenue: 1,

        averageRevenue: {
          $cond: [
            {
              $eq: ["$subscriptions", 0],
            },

            0,

            {
              $divide: ["$totalRevenue", "$subscriptions"],
            },
          ],
        },
      },
    },

    {
      $sort: {
        totalRevenue: -1,
      },
    },

    {
      $limit: 5,
    },
  ]);

  return result;
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getRevenueChart = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
) => {
  const match = buildMatch(creatorIds, startDate, endDate);

  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $group: {
        _id: {
          year: {
            $year: "$createdAt",
          },

          month: {
            $month: "$createdAt",
          },
        },

        revenue: {
          $sum: "$price",
        },

        subscriptions: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },

    {
      $project: {
        _id: 0,

        month: {
          $concat: [
            {
              $arrayElemAt: [
                [
                  "",
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
                "$_id.month",
              ],
            },

            " ",

            {
              $toString: "$_id.year",
            },
          ],
        },

        revenue: 1,

        subscriptions: 1,
      },
    },
  ]);

  return result.slice(-12);
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getRecentPartners = async (startDate?: Date, endDate?: Date) => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return Partner.find(filter)
    .select("name logo phone email isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getManagerSummary = async (startDate?: Date, endDate?: Date) => {
  const managerMatch: Record<string, any> = {
    isDeleted: false,
  };

  if (startDate && endDate) {
    managerMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const [partnerAgg, branchAgg] = await Promise.all([
    Partner.aggregate([
      {
        $match: managerMatch,
      },
      {
        $group: {
          _id: null,
          totalPartners: { $sum: 1 },
          activePartners: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
          inactivePartners: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
        },
      },
    ]),

    PartnerBranch.aggregate([
      {
        $match: managerMatch,
      },
      {
        $group: {
          _id: null,
          totalBranches: { $sum: 1 },
          activeBranches: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
          inactiveBranches: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  return {
    partners: partnerAgg[0] ?? {
      totalPartners: 0,
      activePartners: 0,
      inactivePartners: 0,
    },

    branches: branchAgg[0] ?? {
      totalBranches: 0,
      activeBranches: 0,
      inactiveBranches: 0,
    },
  };
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getRecentBranches = async (startDate?: Date, endDate?: Date) => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (startDate && endDate) {
    filter.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  return PartnerBranch.find(filter)
    .populate("partner", "name logo")
    .sort({
      createdAt: -1,
    })
    .limit(5)
    .lean();
};

// ── UPDATED ──
// Every data source now restricted to the current month.
const getManagerDashboard = async () => {
  const { startMonth, endMonth } = getDateRanges();

  const [summary, recentPartners, recentBranches] = await Promise.all([
    getManagerSummary(startMonth, endMonth),
    getRecentPartners(startMonth, endMonth),
    getRecentBranches(startMonth, endMonth),
  ]);

  return {
    summary: {
      totalPartners: summary.partners.totalPartners,
      activePartners: summary.partners.activePartners,
      inactivePartners: summary.partners.inactivePartners,
      totalBranches: summary.branches.totalBranches,
      activeBranches: summary.branches.activeBranches,
      inactiveBranches: summary.branches.inactiveBranches,
    },
    recentPartners,
    recentBranches,
  };
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getCustomerRevenueChart = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
) => {
  const match = buildCustomerMatch(customerId, startDate, endDate);

  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $group: {
        _id: {
          year: {
            $year: "$createdAt",
          },

          month: {
            $month: "$createdAt",
          },
        },

        revenue: {
          $sum: "$price",
        },

        subscriptions: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },

    {
      $project: {
        _id: 0,

        month: {
          $concat: [
            {
              $arrayElemAt: [
                [
                  "",
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
                "$_id.month",
              ],
            },

            " ",

            {
              $toString: "$_id.year",
            },
          ],
        },

        revenue: 1,

        subscriptions: 1,
      },
    },
  ]);

  return result.slice(-12);
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getCustomerRecentSubscriptions = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
) => {
  return getRecentSubscriptionsByCustomer([customerId], startDate, endDate);
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getSubscriptionStatusChart = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
) => {
  const match = buildMatch(creatorIds, startDate, endDate);

  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $group: {
        _id: "$status",

        value: {
          $sum: 1,
        },
      },
    },

    {
      $project: {
        _id: 0,

        name: "$_id",

        value: 1,
      },
    },

    {
      $sort: {
        value: -1,
      },
    },
  ]);

  return result;
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getPaymentStatusChart = async (
  creatorIds?: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
) => {
  const match: Record<string, any> = {
    isDeleted: false,
  };

  if (creatorIds?.length) {
    match.createdBy = {
      $in: creatorIds,
    };
  }

  if (startDate && endDate) {
    match.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const result = await Subscription.aggregate([
    {
      $match: match,
    },

    {
      $group: {
        _id: "$paymentStatus",

        value: {
          $sum: 1,
        },
      },
    },

    {
      $project: {
        _id: 0,

        name: "$_id",

        value: 1,
      },
    },

    {
      $sort: {
        value: -1,
      },
    },
  ]);

  return result;
};

// ── UPDATED ──
// Added optional startDate/endDate. Admin / super admin call this with no
// dates (unrestricted); A_A_MANAGER passes current month. Restricts
// subscription & customer counts; package / agent / agent leader counts
// stay unrestricted (current roster, not activity).
const getAdminSummary = async (
  startDate?: Date,
  endDate?: Date,
): Promise<IDashboardSummary> => {
  const subMatch: Record<string, any> = {
    isDeleted: false,
  };

  const customerMatch: Record<string, any> = {
    role: Role.CUSTOMER,
    isDeleted: false,
  };

  if (startDate && endDate) {
    subMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };

    customerMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const [
    subscriptionAgg,
    customerCount,
    packageCount,
    agentCount,
    agentLeaderCount,
  ] = await Promise.all([
    Subscription.aggregate([
      {
        $match: subMatch,
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                "$price",
                0,
              ],
            },
          },

          totalSubscriptions: {
            $sum: 1,
          },

          activeSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.ACTIVE],
                },
                1,
                0,
              ],
            },
          },

          pendingSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.PENDING],
                },
                1,
                0,
              ],
            },
          },

          expiredSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.EXPIRED],
                },
                1,
                0,
              ],
            },
          },

          cancelledSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.CANCELLED],
                },
                1,
                0,
              ],
            },
          },

          paidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                1,
                0,
              ],
            },
          },

          unpaidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.UNPAID],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    User.countDocuments(customerMatch),

    InsurancePackage.countDocuments({
      isDeleted: false,
    }),

    User.countDocuments({
      role: Role.AGENT,
      isDeleted: false,
    }),

    User.countDocuments({
      role: Role.AGENT_LEADER,
      isDeleted: false,
    }),
  ]);

  const summary = subscriptionAgg[0];

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalSubscriptions = summary?.totalSubscriptions ?? 0;

  return {
    totalRevenue,
    totalSubscriptions,

    totalCustomers: customerCount,

    totalPackages: packageCount,

    totalAgents: agentCount,

    totalAgentLeaders: agentLeaderCount,

    activeSubscriptions: summary?.activeSubscriptions ?? 0,
    pendingSubscriptions: summary?.pendingSubscriptions ?? 0,
    expiredSubscriptions: summary?.expiredSubscriptions ?? 0,
    cancelledSubscriptions: summary?.cancelledSubscriptions ?? 0,

    paidSubscriptions: summary?.paidSubscriptions ?? 0,
    unpaidSubscriptions: summary?.unpaidSubscriptions ?? 0,

    averageRevenue:
      totalSubscriptions === 0
        ? 0
        : Number((totalRevenue / totalSubscriptions).toFixed(2)),
  };
};

// ── UPDATED ──
// Added optional startDate/endDate — restricts subscription & customer
// counts to the given range. Team agent count (roster) stays unrestricted.
const getAgentLeaderSummary = async (
  creatorIds: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IDashboardSummary> => {
  const subMatch: Record<string, any> = {
    createdBy: {
      $in: creatorIds,
    },
    isDeleted: false,
  };

  if (startDate && endDate) {
    subMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const customerMatch: Record<string, any> = {
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: {
      $in: creatorIds,
    },
  };

  if (startDate && endDate) {
    customerMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const [subscriptionAgg, customerCount, teamAgentCount, packageCount] =
    await Promise.all([
      Subscription.aggregate([
        {
          $match: subMatch,
        },
        {
          $group: {
            _id: null,

            totalRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                  },
                  "$price",
                  0,
                ],
              },
            },

            totalSubscriptions: {
              $sum: 1,
            },

            activeSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", SubscriptionStatus.ACTIVE],
                  },
                  1,
                  0,
                ],
              },
            },

            pendingSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", SubscriptionStatus.PENDING],
                  },
                  1,
                  0,
                ],
              },
            },

            expiredSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", SubscriptionStatus.EXPIRED],
                  },
                  1,
                  0,
                ],
              },
            },

            cancelledSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$status", SubscriptionStatus.CANCELLED],
                  },
                  1,
                  0,
                ],
              },
            },

            paidSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                  },
                  1,
                  0,
                ],
              },
            },

            unpaidSubscriptions: {
              $sum: {
                $cond: [
                  {
                    $eq: ["$paymentStatus", PaymentStatus.UNPAID],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      User.countDocuments(customerMatch),

      // Team roster size — not date-restricted, this is the current team, not activity
      User.countDocuments({
        role: Role.AGENT,
        isDeleted: false,
        agentLeader: creatorIds[0],
      }),

      InsurancePackage.countDocuments({
        isDeleted: false,
      }),
    ]);

  const summary = subscriptionAgg[0];

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalSubscriptions = summary?.totalSubscriptions ?? 0;

  return {
    totalRevenue,
    totalSubscriptions,

    totalCustomers: customerCount,

    totalPackages: packageCount,

    totalAgents: teamAgentCount,

    totalAgentLeaders: 0,

    activeSubscriptions: summary?.activeSubscriptions ?? 0,
    pendingSubscriptions: summary?.pendingSubscriptions ?? 0,
    expiredSubscriptions: summary?.expiredSubscriptions ?? 0,
    cancelledSubscriptions: summary?.cancelledSubscriptions ?? 0,

    paidSubscriptions: summary?.paidSubscriptions ?? 0,
    unpaidSubscriptions: summary?.unpaidSubscriptions ?? 0,

    averageRevenue:
      totalSubscriptions === 0
        ? 0
        : Number((totalRevenue / totalSubscriptions).toFixed(2)),
  };
};

// ── UPDATED ──
// Added optional startDate/endDate — restricts subscription & customer
// counts to the given range.
const getAgentSummary = async (
  creatorIds: Types.ObjectId[],
  startDate?: Date,
  endDate?: Date,
): Promise<IDashboardSummary> => {
  const subMatch: Record<string, any> = {
    createdBy: {
      $in: creatorIds,
    },
    isDeleted: false,
  };

  if (startDate && endDate) {
    subMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const customerMatch: Record<string, any> = {
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: {
      $in: creatorIds,
    },
  };

  if (startDate && endDate) {
    customerMatch.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };
  }

  const [subscriptionAgg, customerCount, packageCount] = await Promise.all([
    Subscription.aggregate([
      {
        $match: subMatch,
      },
      {
        $group: {
          _id: null,

          totalRevenue: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                "$price",
                0,
              ],
            },
          },

          totalSubscriptions: {
            $sum: 1,
          },

          activeSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.ACTIVE],
                },
                1,
                0,
              ],
            },
          },

          pendingSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.PENDING],
                },
                1,
                0,
              ],
            },
          },

          expiredSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.EXPIRED],
                },
                1,
                0,
              ],
            },
          },

          cancelledSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$status", SubscriptionStatus.CANCELLED],
                },
                1,
                0,
              ],
            },
          },

          paidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.COMPLETED],
                },
                1,
                0,
              ],
            },
          },

          unpaidSubscriptions: {
            $sum: {
              $cond: [
                {
                  $eq: ["$paymentStatus", PaymentStatus.UNPAID],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    User.countDocuments(customerMatch),

    InsurancePackage.countDocuments({
      isDeleted: false,
    }),
  ]);

  const summary = subscriptionAgg[0];

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalSubscriptions = summary?.totalSubscriptions ?? 0;

  return {
    totalRevenue,
    totalSubscriptions,

    totalCustomers: customerCount,

    totalPackages: packageCount,

    totalAgents: 0,

    totalAgentLeaders: 0,

    activeSubscriptions: summary?.activeSubscriptions ?? 0,
    pendingSubscriptions: summary?.pendingSubscriptions ?? 0,
    expiredSubscriptions: summary?.expiredSubscriptions ?? 0,
    cancelledSubscriptions: summary?.cancelledSubscriptions ?? 0,

    paidSubscriptions: summary?.paidSubscriptions ?? 0,
    unpaidSubscriptions: summary?.unpaidSubscriptions ?? 0,

    averageRevenue:
      totalSubscriptions === 0
        ? 0
        : Number((totalRevenue / totalSubscriptions).toFixed(2)),
  };
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getCustomerSubscriptionStatusChart = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
) => {
  return Subscription.aggregate([
    {
      $match: buildCustomerMatch(customerId, startDate, endDate),
    },

    {
      $group: {
        _id: "$status",

        value: {
          $sum: 1,
        },
      },
    },

    {
      $project: {
        _id: 0,

        name: "$_id",

        value: 1,
      },
    },

    {
      $sort: {
        value: -1,
      },
    },
  ]);
};

// ── UPDATED ──
// Added optional startDate/endDate.
const getCustomerPaymentStatusChart = async (
  customerId: Types.ObjectId,
  startDate?: Date,
  endDate?: Date,
) => {
  return Subscription.aggregate([
    {
      $match: buildCustomerMatch(customerId, startDate, endDate),
    },

    {
      $group: {
        _id: "$paymentStatus",

        value: {
          $sum: 1,
        },
      },
    },

    {
      $project: {
        _id: 0,

        name: "$_id",

        value: 1,
      },
    },

    {
      $sort: {
        value: -1,
      },
    },
  ]);
};

// ── UPDATED ──
// Every data source now restricted to the current month.
const getCustomerDashboard = async (
  userId: string,
): Promise<IDashboardResponse> => {
  const customerId = new Types.ObjectId(userId);
  const { startMonth, endMonth } = getDateRanges();

  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
  ] = await Promise.all([
    getCustomerSummary(customerId, startMonth, endMonth),

    generateCustomerOverview(customerId, { start: startMonth, end: endMonth }),

    getCustomerTopPackages(customerId, startMonth, endMonth),

    getCustomerRevenueChart(customerId, startMonth, endMonth),

    getCustomerSubscriptionStatusChart(customerId, startMonth, endMonth),

    getCustomerPaymentStatusChart(customerId, startMonth, endMonth),

    getCustomerRecentSubscriptions(customerId, startMonth, endMonth),
  ]);

  return {
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers: [],
  };
};

// ── UNCHANGED ── (no restriction — admin / super admin sees everything, lifetime)
const getAdminDashboard = async (): Promise<IDashboardResponse> => {
  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  ] = await Promise.all([
    getAdminSummary(),

    generateOverview(),

    getTopPackages(),

    getRevenueChart(),

    getSubscriptionStatusChart(),

    getPaymentStatusChart(),

    getRecentSubscriptions(),

    getRecentCustomers(),
  ]);

  return {
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  };
};

// ── UPDATED ──
// Every data source now restricted to the current month.
const getAgentDashboard = async (
  userId: string,
): Promise<IDashboardResponse> => {
  const creatorIds = [new Types.ObjectId(userId)];
  const { startMonth, endMonth } = getDateRanges();

  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  ] = await Promise.all([
    getAgentSummary(creatorIds, startMonth, endMonth),

    generateOverview(creatorIds, { start: startMonth, end: endMonth }),

    getTopPackages(creatorIds, startMonth, endMonth),

    getRevenueChart(creatorIds, startMonth, endMonth),

    getSubscriptionStatusChart(creatorIds, startMonth, endMonth),

    getPaymentStatusChart(creatorIds, startMonth, endMonth),

    getRecentSubscriptions(creatorIds, startMonth, endMonth),

    getRecentCustomers(creatorIds, startMonth, endMonth),
  ]);

  return {
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  };
};

// ── UPDATED ──
// Every data source now restricted to the current month.
const getAgentLeaderDashboard = async (
  userId: string,
): Promise<IDashboardResponse> => {
  const leader = await User.findOne({
    _id: userId,
    role: Role.AGENT_LEADER,
    isDeleted: false,
  });

  if (!leader) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent Leader not found");
  }

  const agents = await User.find({
    role: Role.AGENT,
    isDeleted: false,
    agentLeader: leader._id,
  }).select("_id");

  const creatorIds = [
    leader._id as Types.ObjectId,
    ...agents.map((agent) => agent._id as Types.ObjectId),
  ];

  const { startMonth, endMonth } = getDateRanges();

  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  ] = await Promise.all([
    getAgentLeaderSummary(creatorIds, startMonth, endMonth),

    generateOverview(creatorIds, { start: startMonth, end: endMonth }),

    getTopPackages(creatorIds, startMonth, endMonth),

    getRevenueChart(creatorIds, startMonth, endMonth),

    getSubscriptionStatusChart(creatorIds, startMonth, endMonth),

    getPaymentStatusChart(creatorIds, startMonth, endMonth),

    getRecentSubscriptions(creatorIds, startMonth, endMonth),

    getRecentCustomers(creatorIds, startMonth, endMonth),
  ]);

  return {
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  };
};

// ── NEW ──
// A_A_MANAGER: same data as the admin dashboard, restricted to the
// current month.
const getAAManagerDashboard = async (): Promise<IDashboardResponse> => {
  const { startMonth, endMonth } = getDateRanges();

  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  ] = await Promise.all([
    getAdminSummary(startMonth, endMonth),

    generateOverview(undefined, { start: startMonth, end: endMonth }),

    getTopPackages(undefined, startMonth, endMonth),

    getRevenueChart(undefined, startMonth, endMonth),

    getSubscriptionStatusChart(undefined, startMonth, endMonth),

    getPaymentStatusChart(undefined, startMonth, endMonth),

    getRecentSubscriptions(undefined, startMonth, endMonth),

    getRecentCustomers(undefined, startMonth, endMonth),
  ]);

  return {
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
    recentCustomers,
  };
};

export const DashboardServices = {
  getAAManagerDashboard,
  getAdminDashboard,
  getAgentDashboard,
  getAgentLeaderDashboard,
  getCustomerDashboard,
  getManagerDashboard,
};