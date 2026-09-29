
/* eslint-disable @typescript-eslint/no-unused-vars */
import httpStatus from "http-status-codes";
import { IsActive, IUser, Role } from "./user.interface";
import { User } from "./user.model";
import AppError from "../../errorHelpers/appError";
import bcryptjs from "bcryptjs";
import { envVars } from "../../config/env";
import { JwtPayload } from "jsonwebtoken";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { userSearchableFields } from "./user.constants";
import { Types } from "mongoose";
import { generateCustomId } from "../../utils/counterHelper";

const UPDATABLE_PROFILE_FIELDS = [
  "name",
  "email",
  "nid",
  "phone",
  "dateOfBirth",
  "gender",
  "address",
  "picture",
] as const;

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
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  return { dateFilter, startDateStr, endDateStr };
};

// =============================================================
// CUSTOMER VISIBILITY (current-month restriction) HELPER
// =============================================================
// Admin / Super Admin -> no restriction, they can see ALL customers.
// Everyone else       -> restricted to the CURRENT MONTH by default.
// Exception           -> if the requester is searching (searchTerm present)
//                        or already supplied an explicit startDate/endDate,
//                        the current-month restriction is NOT applied, so
//                        the searched/filtered customer is still visible.

const getCurrentMonthBoundariesUTC = () => {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { start, end };
};

// Checks if searchTerm is a full, valid-length phone number (exactly 11 digits)
const isElevenDigitPhone = (value: string | undefined): boolean => {
  if (!value) return false;
  return /^\d{11}$/.test(value.trim());
};

const applyCustomerVisibilityFilter = ({
  query,
  isAdminOrSuperAdmin,
  dateFilter,
}: {
  query: Record<string, string>;
  isAdminOrSuperAdmin: boolean;
  dateFilter: Record<string, { $gte?: Date; $lte?: Date }>;
}): Record<string, { $gte?: Date; $lte?: Date }> => {
  // Admin / Super Admin: always unrestricted, respects whatever date filter they pass
  if (isAdminOrSuperAdmin) return dateFilter;

  // Non-admin (Agent / Agent Leader):
  // Only a FULL 11-digit phone number search bypasses the current-month restriction.
  if (isElevenDigitPhone(query.searchTerm)) return {};

  // Anything else — no search, a partial digit search ("0", "017"...), or a
  // name search — stays restricted to the current month. Explicit
  // startDate/endDate from a non-admin is also ignored here.
  const { start, end } = getCurrentMonthBoundariesUTC();
  return { createdAt: { $gte: start, $lte: end } };
};

// =============================================================
// STATS HELPER
// =============================================================

const getUserStats = async (match: Record<string, any>) => {
  const agg = await User.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.ACTIVE] }, 1, 0] },
        },
        inactive: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.INACTIVE] }, 1, 0] },
        },
        blocked: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.BLOCKED] }, 1, 0] },
        },
      },
    },
    { $project: { _id: 0, total: 1, active: 1, inactive: 1, blocked: 1 } },
  ]);

  return agg[0] || { total: 0, active: 0, inactive: 0, blocked: 0 };
};

// =============================================================
// EXISTING SERVICES
// =============================================================

const createUserService = async (payload: Partial<IUser>) => {
  const isExistUser = await User.findOne({ phone: payload.phone });

  if (isExistUser) {
    throw new AppError(httpStatus.BAD_REQUEST, "Phone number already exists");
  }

  if (payload.role === Role.AGENT) {
    if (!payload.agentLeader) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Agent must have an agentLeader assigned",
      );
    }

    const leader = await User.findById(payload.agentLeader);

    if (!leader) {
      throw new AppError(httpStatus.NOT_FOUND, "Agent Leader not found");
    }

    if (leader.role !== Role.AGENT_LEADER) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Assigned user is not an Agent Leader",
      );
    }
  }

  let password = "";
  if (payload?.password) {
    password = await bcryptjs.hash(
      payload.password as string,
      Number(envVars.BCRYPT_SALT_ROUND),
    );
  }

  // ── Generate unique customId ──
  const customId = await generateCustomId("userCustomId", "SH");

  return await User.create({ ...payload, password, customId });
};

const updateUser = async (
  userId: string,
  payload: Partial<IUser>,
  decodedToken: JwtPayload,
) => {
  const existingUser = await User.findById(userId);

  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const isSuperAdmin = decodedToken.role === Role.SUPER_ADMIN;

  const isAdminOrSuperAdmin =
    decodedToken.role === Role.SUPER_ADMIN ||
    decodedToken.role === Role.ADMIN;

  if (!isAdminOrSuperAdmin && payload.password) {
    delete payload.password;
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password can only be changed by Super Admin or Admin"
    );
  }

  if (isAdminOrSuperAdmin && payload.password) {
    payload.password = await bcryptjs.hash(
      payload.password,
      Number(envVars.BCRYPT_SALT_ROUND)
    );
  }

  // Only Super Admin and admin can modify these protected fields
  if (!isAdminOrSuperAdmin) {
    delete payload.role;
    delete payload.isDeleted;
    delete payload.isVerified;
    delete payload.createdBy;
  }

  // Prevent Super Admin from breaking their own account
  if (isSuperAdmin && userId === decodedToken.userId) {
    if (payload.role && payload.role !== Role.SUPER_ADMIN) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot change your own role",
      );
    }

    if (payload.isDeleted === true) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot delete your own account",
      );
    }

    if (payload.isActive === IsActive.BLOCKED) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot block your own account",
      );
    }
  }

  const updatedUser = await User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: true,
  }).select("-password");

  return {
    data: updatedUser,
  };
};

const getMe = async (userId: string) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User not found",
    );
  }

  const { password, ...rest } = user.toObject();

  return { data: { ...rest, hasPassword: !!password } };
};


const getMyTrashAgents = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.AGENT,
    isDeleted: true,
    agentLeader: new Types.ObjectId(userId),
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("agentLeader", "name phone"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.AGENT,
    isDeleted: true,
    agentLeader: new Types.ObjectId(userId),
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

const getSingleUser = async (id: string) => {
  const user = await User.findById(id).select("-password");
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  return { data: user };
};

const restoreUser = async (id: string) => {
  const user = await User.findById(id);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  }

  if (!user.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is not in trash");
  }

  const restoredUser = await User.findByIdAndUpdate(
    id,
    { isDeleted: false },
    {
      returnDocument: "after",
      runValidators: true,
    },
  ).select("-password");

  return { data: restoredUser };
};

const permanentDeleteUser = async (id: string) => {
  const user = await User.findById(id);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
  }

  if (!user.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Move user to trash before permanent deletion",
    );
  }

  await User.findByIdAndDelete(id);

  return { data: null };
};

const deleteUser = async (id: string) => {
  const user = await User.findById(id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User Not Found");

  await User.findByIdAndUpdate(id, { isDeleted: true });
  return { data: null };
};

const getAllUsers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const queryBuilder = new QueryBuilder(
    User.find({
      role: { $ne: Role.CUSTOMER },
      isDeleted: false,
      ...dateFilter,
    }),
    query,
  );

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build(),
    queryBuilder.getMeta(),
  ]);

  // =========================
  // DETAILED ROLE-WISE STATS
  // =========================
  const statsMatch = {
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const agg = await User.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: "$role",
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.ACTIVE] }, 1, 0] },
        },
        inactive: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.INACTIVE] }, 1, 0] },
        },
        blocked: {
          $sum: { $cond: [{ $eq: ["$isActive", IsActive.BLOCKED] }, 1, 0] },
        },
      },
    },
  ]);

  // build role → stats lookup map
  const roleMap = agg.reduce<Record<string, any>>((map, item) => {
    map[item._id] = {
      total: item.total,
      active: item.active,
      inactive: item.inactive,
      blocked: item.blocked,
    };
    return map;
  }, {});

  const empty = { total: 0, active: 0, inactive: 0, blocked: 0 };

  const stats = {
    total: agg.reduce((sum, item) => sum + item.total, 0),
    superAdmin: roleMap[Role.SUPER_ADMIN] || { ...empty },
    admin: roleMap[Role.ADMIN] || { ...empty },
    manager: roleMap[Role.MANAGER] || { ...empty },
    agentLeader: roleMap[Role.AGENT_LEADER] || { ...empty },
    agent: roleMap[Role.AGENT] || { ...empty },
    customer: roleMap[Role.CUSTOMER] || { ...empty },
    claimsManager: roleMap[Role.CLAIMS_MANAGER] || { ...empty },
  };

  return { data, meta, stats };
};

const getAllTrashUsers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const queryBuilder = new QueryBuilder(
    User.find({ role: { $ne: Role.CUSTOMER }, isDeleted: true, ...dateFilter }),
    query,
  );

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build(),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: { $ne: Role.CUSTOMER },
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all agents
const getAllAgents = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.AGENT,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("agentLeader", "name phone employeeId")
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.AGENT,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all trash agents (regardless of leader)
const getAllTrashAgents = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.AGENT,
    isDeleted: true,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("agentLeader", "name phone employeeId")
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.AGENT,
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

const updateProfile = async (
  payload: Partial<IUser>,
  decodedToken: JwtPayload,
) => {
  const user = await User.findById(decodedToken.userId);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  if (payload.password) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can't change your password here",
    );
  }

  const safePayload: Partial<IUser> = {};
  for (const field of UPDATABLE_PROFILE_FIELDS) {
    if (payload[field] !== undefined) {
      (safePayload as any)[field] = payload[field];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    decodedToken.userId,
    safePayload,
    {
      new: true,
      runValidators: true,
    },
  );

  return { data: updatedUser };
};

// Admin / Super Admin — retrieve all customers (UNRESTRICTED — sees everything)
// const getAllCustomers = async (query: Record<string, string>) => {
//   const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

//   const baseMatch = { role: Role.CUSTOMER, isDeleted: false, ...dateFilter };

//   const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

//   const [data, meta] = await Promise.all([
//     queryBuilder
//       .filter()
//       .search(userSearchableFields)
//       .sort()
//       .fields()
//       .paginate()
//       .build()
//       // .populate("createdBy", "name phone role")
//       // .populate("agentLeader", "name phone role"),
//       .populate({
//         path: "createdBy",
//         select: "name phone role employeeId agentLeader",
//         populate: {
//           path: "agentLeader",
//           select: "name phone role employeeId",
//         },
//       }),
//     queryBuilder.getMeta(),
//   ]);

//   const stats = await getUserStats({
//     role: Role.CUSTOMER,
//     isDeleted: false,
//     ...buildDateFilter(startDateStr, endDateStr),
//   });

//   return { data, meta, stats };
// };


// Admin / Super Admin → sob customer dekhte pare (unrestricted)
// Onno kono role → CURRENT MONTH restricted (full 11-digit phone search bade)
const getAllCustomers = async ({
  query,
  requesterRole,
}: {
  query: Record<string, string>;
  requesterRole: Role;
}) => {
  const { dateFilter } = buildQueryObj(query);

  const isAdminOrSuperAdmin =
    requesterRole === Role.SUPER_ADMIN || requesterRole === Role.ADMIN;

  const visibilityFilter = applyCustomerVisibilityFilter({
    query,
    isAdminOrSuperAdmin,
    dateFilter,
  });

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: false,
    ...visibilityFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate({
        path: "createdBy",
        select: "name phone role employeeId agentLeader",
        populate: {
          path: "agentLeader",
          select: "name phone role employeeId",
        },
      }),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: false,
    ...visibilityFilter,
  });

  return { data, meta, stats };
};

// Agent — retrieve own created customers
// Restricted to CURRENT MONTH by default; bypassed when searching (searchTerm)
const getMyCustomers = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { dateFilter } = buildQueryObj(query);

  const visibilityFilter = applyCustomerVisibilityFilter({
    query,
    isAdminOrSuperAdmin: false,
    dateFilter,
  });

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: new Types.ObjectId(userId),
    ...visibilityFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build(),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: new Types.ObjectId(userId),
    ...visibilityFilter,
  });

  return { data, meta, stats };
};

// Agent Leader — retrieve own agents
const getMyAgents = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.AGENT,
    isDeleted: false,
    agentLeader: new Types.ObjectId(userId),
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("agentLeader", "name phone employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.AGENT,
    isDeleted: false,
    agentLeader: new Types.ObjectId(userId),
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all agent leaders
const getAllAgentLeaders = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.AGENT_LEADER,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.AGENT_LEADER,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all admins
const getAllAdmins = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.ADMIN,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.ADMIN,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all trash admins
const getAllTrashAdmins = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.ADMIN,
    isDeleted: true,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.ADMIN,
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all managers
const getAllManagers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.MANAGER,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.MANAGER,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

const getAllClaimsManagers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.CLAIMS_MANAGER,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CLAIMS_MANAGER,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return {
    data,
    meta,
    stats,
  };
};

const getAllTrashClaimsManagers = async (
  query: Record<string, string>,
) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.CLAIMS_MANAGER,
    isDeleted: true,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CLAIMS_MANAGER,
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return {
    data,
    meta,
    stats,
  };
};

// Admin / Super Admin — retrieve all trash managers
const getAllTrashManagers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.MANAGER,
    isDeleted: true,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.MANAGER,
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all managers
const getAllAAManagers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.A_A_MANAGER,
    isDeleted: false,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.A_A_MANAGER,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Admin / Super Admin — retrieve all trash managers
const getAllTrashAAManagers = async (query: Record<string, string>) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  const baseMatch = {
    role: Role.A_A_MANAGER,
    isDeleted: true,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.A_A_MANAGER,
    isDeleted: true,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Single service — accepts agentLeaderId as param.
// Agent Leader (self): controller passes id from decoded token → CURRENT MONTH restricted.
// Admin / Super Admin: controller passes id from route params → UNRESTRICTED.
// NOTE: controller must now also pass `requesterRole` (decodedToken.role).
const getAllAgentLeaderCustomers = async ({
  query,
  agentLeaderId,
  requesterRole,
}: {
  query: Record<string, string>;
  agentLeaderId: string;
  requesterRole: Role;
}) => {
  // Verify agent leader exists
  const leader = await User.findOne({
    _id: agentLeaderId,
    role: Role.AGENT_LEADER,
    isDeleted: false,
  });

  if (!leader) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent Leader not found");
  }

  // Fetch all agent IDs belonging to this leader
  const agents = await User.find({
    agentLeader: new Types.ObjectId(agentLeaderId),
    role: Role.AGENT,
    isDeleted: false,
  }).select("_id");

  const agentIds = agents.map((a) => a._id);

  const { dateFilter } = buildQueryObj(query);

  const isAdminOrSuperAdmin =
    requesterRole === Role.SUPER_ADMIN || requesterRole === Role.ADMIN;

  const visibilityFilter = applyCustomerVisibilityFilter({
    query,
    isAdminOrSuperAdmin,
    dateFilter,
  });

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: { $in: agentIds },
    ...visibilityFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: { $in: agentIds },
    ...visibilityFilter,
  });

  return { data, meta, stats };
};

// Single service for agent-wise customer lookup — called in 3 ways:
//   - Agent           → agentId from decoded token (own customers) → CURRENT MONTH restricted
//   - Admin/SuperAdmin → agentId from route params (any agent)     → UNRESTRICTED
//   - Agent Leader    → agentId from route params + ownership validation → CURRENT MONTH restricted
const getCustomersByAgent = async ({
  query,
  agentId,
  requesterId, // userId from decoded token
  requesterRole, // role from decoded token
}: {
  query: Record<string, string>;
  agentId: string;
  requesterId: string;
  requesterRole: Role;
}) => {
  // Verify the agent exists
  const agent = await User.findOne({
    _id: agentId,
    role: Role.AGENT,
    isDeleted: false,
  });

  if (!agent) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent not found");
  }

  // Agent Leader restriction — can only view customers of their own agents
  if (requesterRole === Role.AGENT_LEADER) {
    if (!agent.agentLeader || agent.agentLeader.toString() !== requesterId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only view customers of agents under your leadership",
      );
    }
  }

  const { dateFilter } = buildQueryObj(query);

  const isAdminOrSuperAdmin =
    requesterRole === Role.SUPER_ADMIN || requesterRole === Role.ADMIN;

  const visibilityFilter = applyCustomerVisibilityFilter({
    query,
    isAdminOrSuperAdmin,
    dateFilter,
  });

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: new Types.ObjectId(agentId),
    ...visibilityFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: false,
    createdBy: new Types.ObjectId(agentId),
    ...visibilityFilter,
  });

  return {
    data,
    meta,
    stats,
    agent: { _id: agent._id, name: agent.name, phone: agent.phone },
  };
};

const getMyTrashCustomers = async ({
  query,
  userId,
  role,
}: {
  query: Record<string, string>;
  userId: string;
  role: Role;
}) => {
  const { dateFilter, startDateStr, endDateStr } = buildQueryObj(query);

  let createdByFilter: any;

  if (role === Role.AGENT) {
    // Agent → own customers only
    createdByFilter = new Types.ObjectId(userId);
  } else if (role === Role.AGENT_LEADER) {
    // Leader → own customers + own agents' customers
    const agents = await User.find({
      role: Role.AGENT,
      isDeleted: false,
      agentLeader: new Types.ObjectId(userId),
    }).select("_id");

    createdByFilter = {
      $in: [new Types.ObjectId(userId), ...agents.map((a) => a._id)],
    };
  } else {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not authorized to access this resource",
    );
  }

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: true,
    createdBy: createdByFilter,
    ...dateFilter,
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: true,
    createdBy: createdByFilter,
    ...buildDateFilter(startDateStr, endDateStr),
  });

  return { data, meta, stats };
};

// Agent Leader — own + own agents' customers
// Restricted to CURRENT MONTH by default; bypassed when searching (searchTerm)
const getMyCustomersByLeader = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const leader = await User.findById(userId);

  if (!leader) {
    throw new AppError(httpStatus.NOT_FOUND, "Agent Leader not found");
  }

  const agents = await User.find({
    role: Role.AGENT,
    isDeleted: false,
    agentLeader: leader._id,
  }).select("_id");

  const agentIds = agents.map((a) => a._id);

  const { dateFilter } = buildQueryObj(query);

  const visibilityFilter = applyCustomerVisibilityFilter({
    query,
    isAdminOrSuperAdmin: false,
    dateFilter,
  });

  const baseMatch = {
    role: Role.CUSTOMER,
    isDeleted: false,
    ...visibilityFilter,
    $or: [
      {
        createdBy: new Types.ObjectId(userId),
      },
      {
        createdBy: {
          $in: agentIds,
        },
      },
    ],
  };

  const queryBuilder = new QueryBuilder(User.find(baseMatch), query);

  const [data, meta] = await Promise.all([
    queryBuilder
      .filter()
      .search(userSearchableFields)
      .sort()
      .fields()
      .paginate()
      .build()
      .populate("createdBy", "name phone role employeeId"),
    queryBuilder.getMeta(),
  ]);

  const stats = await getUserStats({
    role: Role.CUSTOMER,
    isDeleted: false,
    ...visibilityFilter,
    $or: [
      {
        createdBy: new Types.ObjectId(userId),
      },
      {
        createdBy: {
          $in: agentIds,
        },
      },
    ],
  });

  return { data, meta, stats };
};

export const UserServices = {
  createUserService,
  getMe,
  getSingleUser,
  updateUser,
  updateProfile,
  restoreUser,
  permanentDeleteUser,
  getAllUsers,
  getAllTrashUsers,
  deleteUser,
  getAllCustomers,
  getMyTrashAgents,
  getMyCustomers,
  getMyCustomersByLeader,
  getAllTrashClaimsManagers,
  getAllClaimsManagers,

  getMyTrashCustomers,
  getMyAgents,
  getAllAgents,
  getAllTrashAgents,
  getAllAgentLeaders,
  getAllAdmins,
  getAllTrashAdmins,
  getAllManagers,
  getAllTrashManagers,
  getAllAAManagers,
  getAllTrashAAManagers,
  getAllAgentLeaderCustomers,
  getCustomersByAgent,
};
