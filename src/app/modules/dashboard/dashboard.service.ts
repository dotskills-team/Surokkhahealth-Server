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

const getCustomerSummary = async (
  customerId: Types.ObjectId,
): Promise<IDashboardSummary> => {
  const [subscriptionAgg] = await Promise.all([
    Subscription.aggregate([
      {
        $match: {
          customer: customerId,
          isDeleted: false,
        },
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

const generateCustomerOverview = async (
  customerId: Types.ObjectId,
): Promise<IDashboardOverview> => {
  const { startToday, endToday, startMonth, endMonth } = getDateRanges();

  const [today, month, lifetime] = await Promise.all([
    getOverviewCard(buildCustomerMatch(customerId, startToday, endToday)),

    getOverviewCard(buildCustomerMatch(customerId, startMonth, endMonth)),

    getOverviewCard(buildCustomerMatch(customerId)),
  ]);

  return {
    today,
    month,
    lifetime,
  };
};

const getCustomerTopPackages = async (customerId: Types.ObjectId) => {
  return Subscription.aggregate([
    {
      $match: {
        customer: customerId,
        isDeleted: false,
      },
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

const generateOverview = async (
  creatorIds?: Types.ObjectId[],
): Promise<IDashboardOverview> => {
  const { startToday, endToday, startMonth, endMonth } = getDateRanges();

  const [today, month, lifetime] = await Promise.all([
    getOverviewCard(buildMatch(creatorIds, startToday, endToday)),

    getOverviewCard(buildMatch(creatorIds, startMonth, endMonth)),

    getOverviewCard(buildMatch(creatorIds)),
  ]);

  return {
    today,
    month,
    lifetime,
  };
};

const getRecentSubscriptions = async (
  creatorIds?: Types.ObjectId[],
): Promise<IRecentSubscription[]> => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (creatorIds?.length) {
    filter.createdBy = {
      $in: creatorIds,
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
const getRecentSubscriptionsByCustomer = async (
  customerId?: Types.ObjectId[],
): Promise<IRecentSubscription[]> => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  if (customerId?.length) {
    filter.customer = {
      $in: customerId,
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

const getRecentCustomers = async (
  creatorIds?: Types.ObjectId[],
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

const getTopPackages = async (
  creatorIds?: Types.ObjectId[],
): Promise<IDashboardPackageRevenue[]> => {
  const match = buildMatch(creatorIds);

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

const getRevenueChart = async (creatorIds?: Types.ObjectId[]) => {
  const match = buildMatch(creatorIds);

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

const getRecentPartners = async () => {
  return Partner.find({
    isDeleted: false,
  })
    .select("name logo phone email isActive createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
};

const getManagerSummary = async () => {
  const [partnerAgg, branchAgg] = await Promise.all([
    Partner.aggregate([
      {
        $match: {
          isDeleted: false,
        },
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
        $match: {
          isDeleted: false,
        },
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

const getRecentBranches = async () => {
  return PartnerBranch.find({
    isDeleted: false,
  })
    .populate("partner", "name logo")
    .sort({
      createdAt: -1,
    })
    .limit(5)
    .lean();
};

const getManagerDashboard = async () => {
     const [summary, recentPartners, recentBranches] = await Promise.all([
       getManagerSummary(),
       getRecentPartners(),
       getRecentBranches(),
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

const getCustomerRevenueChart = async (
  customerId: Types.ObjectId,
) => {
 const match = buildCustomerMatch(customerId);

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

const getCustomerRecentSubscriptions = async (customerId: Types.ObjectId) => {
  return getRecentSubscriptionsByCustomer([customerId]);
};

const getSubscriptionStatusChart = async (creatorIds?: Types.ObjectId[]) => {
  const match = buildMatch(creatorIds);

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

const getPaymentStatusChart = async (creatorIds?: Types.ObjectId[]) => {
  const match: Record<string, any> = {
    isDeleted: false,
  };

  if (creatorIds?.length) {
    match.createdBy = {
      $in: creatorIds,
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

const getAdminSummary = async (): Promise<IDashboardSummary> => {
  const [
    subscriptionAgg,
    customerCount,
    packageCount,
    agentCount,
    agentLeaderCount,
  ] = await Promise.all([
    Subscription.aggregate([
      {
        $match: {
          isDeleted: false,
        },
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

    User.countDocuments({
      role: Role.CUSTOMER,
      isDeleted: false,
    }),

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

const getAgentLeaderSummary = async (
  creatorIds: Types.ObjectId[],
): Promise<IDashboardSummary> => {
  const [subscriptionAgg, customerCount, teamAgentCount, packageCount] =
    await Promise.all([
      Subscription.aggregate([
        {
          $match: {
            createdBy: {
              $in: creatorIds,
            },
            isDeleted: false,
          },
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

      User.countDocuments({
        role: Role.CUSTOMER,
        isDeleted: false,
        createdBy: {
          $in: creatorIds,
        },
      }),

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

const getAgentSummary = async (
  creatorIds: Types.ObjectId[],
): Promise<IDashboardSummary> => {
  const [subscriptionAgg, customerCount, packageCount] = await Promise.all([
    Subscription.aggregate([
      {
        $match: {
          createdBy: {
            $in: creatorIds,
          },
          isDeleted: false,
        },
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

    User.countDocuments({
      role: Role.CUSTOMER,
      isDeleted: false,
      createdBy: {
        $in: creatorIds,
      },
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

const getCustomerSubscriptionStatusChart = async (
  customerId: Types.ObjectId,
) => {
  return Subscription.aggregate([
    {
      $match: {
        customer: customerId,
        isDeleted: false,
      },
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

const getCustomerPaymentStatusChart = async (customerId: Types.ObjectId) => {
  return Subscription.aggregate([
    {
      $match: {
        customer: customerId,
        isDeleted: false,
      },
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

const getCustomerDashboard = async (
  userId: string,
): Promise<IDashboardResponse> => {
  const customerId = new Types.ObjectId(userId);

  const [
    summary,
    overview,
    topPackages,
    revenueChart,
    subscriptionStatusChart,
    paymentStatusChart,
    recentSubscriptions,
  ] = await Promise.all([
    getCustomerSummary(customerId),

    generateCustomerOverview(customerId),

    getCustomerTopPackages(customerId),

    getCustomerRevenueChart(customerId),

    getCustomerSubscriptionStatusChart(customerId),

    getCustomerPaymentStatusChart(customerId),

    getCustomerRecentSubscriptions(customerId),
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

const getAgentDashboard = async (
  userId: string,
): Promise<IDashboardResponse> => {
  const creatorIds = [new Types.ObjectId(userId)];

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
    getAgentSummary(creatorIds),

    generateOverview(creatorIds),

    getTopPackages(creatorIds),

    getRevenueChart(creatorIds),

    getSubscriptionStatusChart(creatorIds),

    getPaymentStatusChart(creatorIds),

    getRecentSubscriptions(creatorIds),

    getRecentCustomers(creatorIds),
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
    getAgentLeaderSummary(creatorIds),

    generateOverview(creatorIds),

    getTopPackages(creatorIds),

    getRevenueChart(creatorIds),

    getSubscriptionStatusChart(creatorIds),

    getPaymentStatusChart(creatorIds),

    getRecentSubscriptions(creatorIds),

    getRecentCustomers(creatorIds),
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
  getAdminDashboard,
  getAgentDashboard,
  getAgentLeaderDashboard,
  getCustomerDashboard,
  getManagerDashboard,
};
