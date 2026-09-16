import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Subscription } from "./subscription.model";
import {
  IJoinMember,
  INominee,
  ISubscription,
  NomineeSource,
  PaymentStatus,
  SubscriptionStatus,
} from "./subscription.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { subscriptionSearchableFields } from "./subscription.constants";
import { User } from "../user/user.model";
import { UserServices } from "../user/user.service";
import mongoose, { Types } from "mongoose";
import { IsActive, Role } from "../user/user.interface";
import { InsurancePackage } from "../package/insurancePackage.model";
import { PaymentModel } from "../payment/payment.model";
import { PaymentService } from "../payment/payment.service";
import { sendSMS } from "../../utils/sendSms";
import { PlanType } from "../package/insurance-package.interface";

import { SubscribeFor, IBeneficiary } from "./subscription.interface";
import { MessageType } from "../message/message.interface";

const createSubscription = async (
  payload: Partial<ISubscription> & {
    customerPayload?: {
      name: string;
      phone: string;
      password?: string;
    };
  },
  userId: string,
  role: Role
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Package Validation (moved up — needed to decide isJoint before
    // validating subscribeFor/beneficiary/joinMember below, and to fail
    // fast before creating a new customer for an invalid package)
    const insurancePackage = await InsurancePackage.findById(payload.package);

    if (!insurancePackage) {
      throw new AppError(httpStatus.NOT_FOUND, "Package not found");
    }

    // Plan Validation
    const selectedPlan = insurancePackage.plans.find(
      (plan: { type: PlanType }) => plan.type === payload.planType,
    );

    if (!selectedPlan) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Selected plan is not available for this package",
      );
    }
    const expectedPrice =
      selectedPlan.discountPrice || selectedPlan.regularPrice;

    if (payload.price !== expectedPrice) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Price mismatch. Expected ${expectedPrice}`,
      );
    }

    const isJoint = !!insurancePackage.isJoint;

    let customerId: Types.ObjectId;
    let customer;

    // Customer purchasing for himself
    if (role === Role.CUSTOMER) {
      const existingCustomer = await User.findById(userId);

      if (!existingCustomer) {
        throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
      }

      customerId = existingCustomer._id;
      customer = existingCustomer;
    }

    // Staff selecting existing customer
    else if (payload.customer) {
      const existingCustomer = await User.findById(payload.customer);

      if (!existingCustomer) {
        throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
      }

      customerId = existingCustomer._id;
      customer = existingCustomer;
    }

    // Staff creating new customer
    else if (payload.customerPayload) {
      const existingCustomer = await User.findOne({
        phone: payload.customerPayload.phone,
      });

      if (existingCustomer) {
        customerId = existingCustomer._id;
        customer = existingCustomer;
      } else {
        const createdCustomer = await UserServices.createUserService({
          ...payload.customerPayload,
          role: Role.CUSTOMER,
          isActive: IsActive.CREATED,
          createdBy: new Types.ObjectId(userId),
        });

        customerId = createdCustomer._id as Types.ObjectId;
        customer = createdCustomer;
      }
    }

    else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Customer information is required",
      );
    }

    // Subscribe-for / beneficiary validation — irrelevant for Joint packages,
    // where the primary customer is always the SELF-covered person and the
    // 2nd covered person is captured via joinMember instead.
    const subscribeFor = isJoint
      ? SubscribeFor.SELF
      : payload.subscribeFor ?? SubscribeFor.SELF;

    let beneficiary: IBeneficiary | undefined;

    if (!isJoint && subscribeFor === SubscribeFor.OTHER) {
      const b = payload.beneficiary;

      if (!b?.name?.trim() || !b?.phone?.trim() || !b?.relationship?.trim()) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Beneficiary name, phone and relationship are required",
        );
      }

      beneficiary = {
        name: b.name.trim(),
        phone: b.phone.trim(),
        relationship: b.relationship.trim(),
        ...(b.dateOfBirth && { dateOfBirth: b.dateOfBirth }),
      };
    }

    // Join Member validation — required when the package is Joint
    let joinMember: IJoinMember | undefined;

    if (isJoint) {
      const jm = payload.joinMember;

      if (!jm?.name?.trim() || !jm?.phone?.trim() || !jm?.relationship?.trim()) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Join member name, phone and relationship are required for a Joint package",
        );
      }

      joinMember = {
        name: jm.name.trim(),
        phone: jm.phone.trim(),
        relationship: jm.relationship.trim(),
        ...(jm.dateOfBirth && { dateOfBirth: jm.dateOfBirth }),
      };
    }

    // Nominee validation — always required.
    // If Joint package and source is JOIN_MEMBER, copy from joinMember.
    let nominee: INominee;

    const wantsJoinMemberAsNominee =
      isJoint && payload.nominee?.source === NomineeSource.JOIN_MEMBER;

    if (wantsJoinMemberAsNominee) {
      nominee = {
        source: NomineeSource.JOIN_MEMBER,
        name: joinMember!.name,
        phone: joinMember!.phone,
        relationship: joinMember!.relationship,
        ...(joinMember!.dateOfBirth && { dateOfBirth: joinMember!.dateOfBirth }),
      };
    } else {
      const n = payload.nominee;

      if (!n?.name?.trim() || !n?.phone?.trim() || !n?.relationship?.trim()) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Nominee name, phone and relationship are required",
        );
      }

      nominee = {
        source: NomineeSource.OTHER,
        name: n.name.trim(),
        phone: n.phone.trim(),
        relationship: n.relationship.trim(),
        ...(n.dateOfBirth && { dateOfBirth: n.dateOfBirth }),
      };
    }

    // Date Calculation
    const startDate = new Date();

    let endDate: Date | null = null;

    if (payload.planType !== PlanType.LIFETIME) {
      endDate = new Date(startDate);

      endDate.setMonth(endDate.getMonth() + selectedPlan.durationInMonths);
    }

    if (subscribeFor === SubscribeFor.SELF) {
      const existingSubscription = await Subscription.findOne({
        customer: customerId,
        package: insurancePackage._id,
        subscribeFor: SubscribeFor.SELF,
        isDeleted: false,
      });

      if (existingSubscription) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Customer already has an active subscription for this package",
        );
      }
    }

    const transactionId = `TXN-${Date.now()}`;

    // Create Subscription
    const subscription = await Subscription.create(
      [
        {
          customer: customerId,

          package: insurancePackage._id,

          planType: selectedPlan.type,

          durationInMonths:
            payload.planType === PlanType.LIFETIME
              ? undefined
              : selectedPlan.durationInMonths,

          price: payload.price,

          transactionId: transactionId,

          paymentStatus: PaymentStatus.UNPAID,

          status: SubscriptionStatus.PENDING,

          startDate,

          endDate,

          isLifetime: payload.planType === PlanType.LIFETIME,

          subscribeFor,

          ...(beneficiary && { beneficiary }),

          ...(joinMember && { joinMember }),

          nominee,

          createdBy: new Types.ObjectId(userId),

          autoRenew: payload.autoRenew ?? false,

          isDeleted: false,

          isActive: false,
        },
      ],
      { session },
    );

    const amount = subscription[0].price;

    if (!amount) {
      throw new AppError(httpStatus.BAD_REQUEST, "Course price not found");
    }

    await PaymentModel.create({
      subscription: subscription[0]._id,
      transactionId,
      amount,
    });

    await session.commitTransaction();
    session.endSession();

    const paymentInitRes = await PaymentService.initPayment(
      subscription[0]._id,
    );

    return {
      data: {
        subscription: subscription[0],
        paymentUrl: paymentInitRes.paymentUrl,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// =========================================================
// SHARED HELPERS (date filter + stats shape)
// Kept private to this module so every list endpoint stays
// in sync with the pattern used in getAllSubscriptions.
// =========================================================

const dateFieldMap: Record<string, string> = {
  created: "createdAt",
  updatedAt: "updatedAt",
  startDate: "startDate",
  endDate: "endDate",
};

// Subscription document stores `customer` as an ObjectId reference — you
// cannot regex-search `customer.name` on the raw document.  This helper
// looks up matching User IDs BEFORE the main query so we can inject
// { customer: { $in: [...ids] } } into the Subscription find filter.
//
// Also resolves `createdBy` the same way so agent-name search also works.
//
// Returns an empty object when no searchTerm is given (no extra filter).
const resolveCustomerFilter = async (
  searchTerm?: string,
): Promise<Record<string, any>> => {
  if (!searchTerm || !searchTerm.trim()) return {};

  const matchingUsers = await User.find({
    $or: [
      { name: { $regex: searchTerm, $options: "i" } },
      { phone: { $regex: searchTerm, $options: "i" } },
    ],
  }).select("_id");

  if (!matchingUsers.length) return { _id: null }; // no user matched → force empty result

  const userIds = matchingUsers.map((u) => u._id);

  // match subscriptions where the customer OR the creator matches
  return {
    $or: [{ customer: { $in: userIds } }, { createdBy: { $in: userIds } }],
  };
};

// Returns the 00:00:00.000 -> 23:59:59.999 UTC boundary for the calendar
// day represented by a date-only string like "2026-06-18". Using UTC
// components (instead of setHours, which uses server-local time) keeps
// this correct no matter what timezone the server runs in.
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

// Date filtering rules (per product requirement):
// - startDate AND endDate given -> inclusive range between the two days
// - ONLY startDate given        -> records on that single day only
// - ONLY endDate given          -> records on that single day only
// - neither given                -> no date filter
const buildDateRangeFilter = (
  startDateStr?: string,
  endDateStr?: string,
): { $gte: Date; $lte: Date } | null => {
  if (startDateStr && endDateStr) {
    return {
      $gte: getDayBoundariesUTC(startDateStr).start,
      $lte: getDayBoundariesUTC(endDateStr).end,
    };
  }

  if (startDateStr) {
    const { start, end } = getDayBoundariesUTC(startDateStr);
    return { $gte: start, $lte: end };
  }

  if (endDateStr) {
    const { start, end } = getDayBoundariesUTC(endDateStr);
    return { $gte: start, $lte: end };
  }

  return null;
};

// Decides WHICH field(s) the startDate/endDate query params apply to.
//
// - dateType given (created / updatedAt / startDate / endDate) -> EXPLICIT
//   mode: both params act as bounds on that ONE field (range if both
//   given, exact-day match if only one given) — same logic as before.
//
// - dateType NOT given -> DEFAULT mode:
//     * ONLY startDate given -> exact-day match on doc.startDate
//     * ONLY endDate given   -> exact-day match on doc.endDate
//     * BOTH given           -> RANGE: doc.startDate >= startDate param
//       AND doc.endDate <= endDate param, i.e. every subscription whose
//       active window falls inside the given two dates.

const buildDateFilterObject = (
  dateType: string | undefined,
  startDateStr?: string,
  endDateStr?: string,
): Record<string, { $gte?: Date; $lte?: Date }> => {
  const result: Record<string, { $gte?: Date; $lte?: Date }> = {};

  if (dateType && dateFieldMap[dateType]) {
    const dateField = dateFieldMap[dateType];
    const range = buildDateRangeFilter(startDateStr, endDateStr);

    if (range) {
      result[dateField] = range;
    }

    return result;
  }

  if (startDateStr && endDateStr) {
    result.startDate = { $gte: getDayBoundariesUTC(startDateStr).start };
    result.endDate = { $lte: getDayBoundariesUTC(endDateStr).end };
    return result;
  }

  if (startDateStr) {
    const { start, end } = getDayBoundariesUTC(startDateStr);
    result.startDate = { $gte: start, $lte: end };
    return result;
  }

  if (endDateStr) {
    const { start, end } = getDayBoundariesUTC(endDateStr);
    result.endDate = { $gte: start, $lte: end };
    return result;
  }

  return result;
};

const buildDateAndStatusFilter = (query: Record<string, string>) => {
  const queryObj: any = {};

  // capture the raw strings BEFORE we delete them from query, so the
  // stats aggregation below can reuse the exact same date range
  const dateType = query.dateType;
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];

  Object.assign(
    queryObj,
    buildDateFilterObject(dateType, startDateStr, endDateStr),
  );

  if (query.status) {
    queryObj.status = query.status;
  }

  if (query.paymentStatus) {
    queryObj.paymentStatus = query.paymentStatus;
  }

  // remove special fields so QueryBuilder doesn't choke on them
  delete query.startDate;
  delete query.endDate;
  delete query.dateType;

  return { queryObj, dateType, startDateStr, endDateStr };
};

const buildStatsMatch = (
  baseMatch: Record<string, any>,
  dateType: string | undefined,
  startDateStr?: string,
  endDateStr?: string,
) => {
  return {
    ...baseMatch,
    ...buildDateFilterObject(dateType, startDateStr, endDateStr),
  };
};

const getSubscriptionStats = async (statsMatch: Record<string, any>) => {
  const statsAgg = await Subscription.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,

        total: { $sum: 1 },

        active: {
          $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
        },

        pending: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
        },

        expired: {
          $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] },
        },

        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
        },

        paid: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, 1, 0] },
        },

        unpaid: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "UNPAID"] }, 1, 0] },
        },

        refunded: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "REFUNDED"] }, 1, 0] },
        },

        failed: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "FAILED"] }, 1, 0] },
        },

        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$price", 0],
          },
        },
      },
    },
  ]);

  return (
    statsAgg[0] || {
      total: 0,
      active: 0,
      pending: 0,
      expired: 0,
      cancelled: 0,
      paid: 0,
      unpaid: 0,
      refunded: 0,
      failed: 0,
      totalRevenue: 0,
    }
  );
};

// Resolves a free-text searchTerm into a Subscription-level $or filter
// that matches customer name OR createdBy name.
const getAllSubscriptions = async (query: Record<string, string>) => {
  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Subscription.find({
    isDeleted: false,
    ...queryObj,
    ...customerFilter,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role employeeId");

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = buildStatsMatch(
    { isDeleted: false },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getAllSubscriptionsByAgent = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Subscription.find({
    isDeleted: false,
    createdBy: userId,
    ...queryObj,
    ...customerFilter,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = buildStatsMatch(
    { isDeleted: false, createdBy: new Types.ObjectId(userId) },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getMySubscriptions = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  const ownershipFilter = {
    $or: [{ createdBy: userId }, { customer: userId }],
  };

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Subscription.find({
    isDeleted: false,
    ...queryObj,
    // combine ownership $or and customer-search $or safely with $and
    ...(customerFilter.$or
      ? { $and: [ownershipFilter, customerFilter] }
      : ownershipFilter),
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = buildStatsMatch(
    {
      isDeleted: false,
      $or: [
        { createdBy: new Types.ObjectId(userId) },
        { customer: new Types.ObjectId(userId) },
      ],
    },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getMyTrashSubscriptions = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  const ownershipFilter = {
    $or: [{ createdBy: userId }, { customer: userId }],
  };

  const baseQuery = Subscription.find({
    isDeleted: true,
    ...queryObj,
    ...(customerFilter.$or
      ? { $and: [ownershipFilter, customerFilter] }
      : ownershipFilter),
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  const statsMatch = buildStatsMatch(
    {
      isDeleted: true,
      $or: [
        { createdBy: new Types.ObjectId(userId) },
        { customer: new Types.ObjectId(userId) },
      ],
    },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getAllTrashSubscriptions = async (query: Record<string, string>) => {
  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  // =========================
  // BASE DATA QUERY
  // =========================
  const baseQuery = Subscription.find({
    isDeleted: true,
    ...queryObj,
    ...customerFilter,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // =========================
  // STATS QUERY
  // =========================
  const statsMatch = buildStatsMatch(
    { isDeleted: true },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getAgentLeaderSubscriptions = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  // 1. Get agents under leader
  const agents = await User.find({
    agentLeader: userId,
    role: Role.AGENT,
  }).select("_id");

  const agentIds = agents.map((a) => a._id);

  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  // =========================
  // BASE DATA QUERY (subscriptions created by those agents)
  // =========================
  const baseQuery = Subscription.find({
    isDeleted: false,
    createdBy: { $in: agentIds },
    ...queryObj,
    ...customerFilter,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  // STATS QUERY (scoped to this leader's agents)
  const statsMatch = buildStatsMatch(
    { isDeleted: false, createdBy: { $in: agentIds } },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getAgentLeaderTrashSubscriptions = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const agents = await User.find({
    agentLeader: userId,
    role: Role.AGENT,
  }).select("_id");

  const agentIds = agents.map((a) => a._id);

  const { queryObj, dateType, startDateStr, endDateStr } =
    buildDateAndStatusFilter(query);

  const customerFilter = await resolveCustomerFilter(query.searchTerm);

  const baseQuery = Subscription.find({
    isDeleted: true,
    createdBy: { $in: agentIds },
    ...queryObj,
    ...customerFilter,
  });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(subscriptionSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    .populate("createdBy", "name phone role");

  const meta = await queryBuilder.getMeta();

  const statsMatch = buildStatsMatch(
    { isDeleted: true, createdBy: { $in: agentIds } },
    dateType,
    startDateStr,
    endDateStr,
  );
  const stats = await getSubscriptionStats(statsMatch);

  return {
    data,
    meta,
    stats,
  };
};

const getSingleSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id)
    .populate("customer")
    .populate("package")
    .populate("createdBy", "name role");

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  return subscription;
};

const softDeleteSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id);

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  return await Subscription.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

const permanentDeleteSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id);

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  await Subscription.findByIdAndDelete(id);

  return null;
};

const updateSubscription = async (
  id: string,
  payload: Partial<ISubscription>,
) => {
  const existing = await Subscription.findById(id);

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  // prevent invalid updates
  if (payload.planType === PlanType.LIFETIME) {
    payload.durationInMonths = undefined;
    payload.endDate = null;
  }

  if (payload.planType && payload.planType !== PlanType.LIFETIME) {
    const durationMap: Record<string, number> = {
      MONTHLY: 1,
      QUARTERLY: 3,
      HALF_YEARLY: 6,
      YEARLY: 12,
    };

    const duration = durationMap[payload.planType];

    payload.durationInMonths = duration;

    const startDate = payload.startDate || existing.startDate;

    payload.endDate = new Date(
      new Date(startDate).getTime() + duration * 30 * 24 * 60 * 60 * 1000,
    );
  }

  const updated = await Subscription.findByIdAndUpdate(id, payload, {
    returnDocument: "after",
    runValidators: true,
  });

  return updated;
};

const restoreSubscription = async (id: string) => {
  const subscription = await Subscription.findById(id);

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  return await Subscription.findByIdAndUpdate(
    id,
    { isDeleted: false },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );
};

const getCustomerSubscriptions = async ({
  customerId,
  requesterId,
  requesterRole,
}: {
  customerId: string;
  requesterId: string;
  requesterRole: Role;
}) => {
  const filter: Record<string, any> = {
    customer: customerId,
    isDeleted: false,
  };

  // Admin/SuperAdmin can see ALL subscriptions of this customer.
  // Everyone else only sees subscriptions THEY created for this customer.
  if (![Role.SUPER_ADMIN, Role.ADMIN, Role.CLAIMS_MANAGER, Role.AGENT_LEADER, Role.AGENT, Role.A_A_MANAGER].includes(requesterRole)) {
    filter.createdBy = requesterId;
  }

  const subscriptions = await Subscription.find(filter)
    .populate("customer", "name phone")
    .populate("package", "name slug description coverageAmount")
    // .populate("createdBy", "name phone role")
    .populate({
      path: "createdBy",
      select: "name phone role agentLeader employeeId",
      populate: {
        path: "agentLeader",
        select: "name phone role employeeId",
      },
    })
    .sort({ createdAt: -1 });

  return subscriptions;
};

export const SubscriptionServices = {
  createSubscription,
  getAllSubscriptions,
  getAllTrashSubscriptions,
  getSingleSubscription,
  softDeleteSubscription,
  updateSubscription,
  permanentDeleteSubscription,
  restoreSubscription,
  getAllSubscriptionsByAgent,
  getAgentLeaderSubscriptions,
  getAgentLeaderTrashSubscriptions,
  getMySubscriptions,
  getMyTrashSubscriptions,
  getCustomerSubscriptions
};
