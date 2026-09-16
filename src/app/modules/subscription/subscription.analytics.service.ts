import { Types } from "mongoose";
import { Subscription } from "./subscription.model";
import { User } from "../user/user.model";
import { Role } from "../user/user.interface";
import {
  IOverviewCard,
  IOverviewResponse,
  PaymentStatus,
} from "./subscription.interface";

const getDateRanges = () => {
  const now = new Date();

  // Today
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  // Month

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
    paymentStatus: PaymentStatus.PAID,
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

const getOverviewCard = async (
  match: Record<string, any>,
): Promise<IOverviewCard> => {
  const [result] = await Subscription.aggregate([
    {
      $match: match,
    },

    // Only fetch package name
    {
      $lookup: {
        from: "insurancepackages",
        let: {
          packageId: "$package",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", "$$packageId"],
              },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
            },
          },
        ],
        as: "package",
      },
    },

    {
      $unwind: {
        path: "$package",
        preserveNullAndEmptyArrays: true,
      },
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

          {
            $project: {
              _id: 0,

              subscriptions: 1,

              revenue: 1,

              averageRevenue: {
                $cond: [
                  {
                    $eq: ["$subscriptions", 0],
                  },
                  0,
                  {
                    $divide: ["$revenue", "$subscriptions"],
                  },
                ],
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

  const summary = result?.summary?.[0];

  return {
    subscriptions: summary?.subscriptions ?? 0,

    revenue: summary?.revenue ?? 0,

    averageRevenue: summary?.averageRevenue ?? 0,

    packageWiseRevenue: result?.packageWiseRevenue ?? [],
  };
};

const generateOverview = async (
  creatorIds?: Types.ObjectId[],
): Promise<IOverviewResponse> => {
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

const getAdminOverview = async () => {
  return generateOverview();
};

const getAgentOverview = async (userId: string) => {
  return generateOverview([new Types.ObjectId(userId)]);
};

const getAgentLeaderOverview = async (userId: string) => {
  const leader = await User.findOne({
    _id: userId,
    role: Role.AGENT_LEADER,
    isDeleted: false,
  });

  if (!leader) {
    throw new Error("Agent Leader not found");
  }

  const agents = await User.find({
    role: Role.AGENT,
    isDeleted: false,
    agentLeader: leader._id,
  }).select("_id");

  const creatorIds = [leader._id, ...agents.map((agent) => agent._id)];

  return generateOverview(creatorIds);
};

export const SubscriptionAnalyticsService = {
  getAdminOverview,
  getAgentOverview,
  getAgentLeaderOverview,
};
