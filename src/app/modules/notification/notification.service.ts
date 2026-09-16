import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Notification } from "./notification.model";
import { INotification } from "./notification.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { Role } from "../user/user.interface";
import { notificationSearchableFields } from "./notification.constants";
import { User } from "../user/user.model";

const createNotification = async (payload: INotification) => {
  return await Notification.create(payload);
};

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

const getAllNotifications = async ({
  query,
  user,
}: {
  query: Record<string, string>;
  user: {
    userId: string;
    role: string;
  };
}) => {
  const isAdminLevel =
    user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  // ROLE-BASED BASE FILTER
  const baseFilter: any = { ...dateFilter };

  if (!isAdminLevel) {
    baseFilter.user = user.userId;
  }

  // isRead filter (true / false)
  if (query.isRead !== undefined) {
    baseFilter.isRead = query.isRead === "true";
    delete query.isRead;
  }

  // type filter
  if (query.type !== undefined) {
    baseFilter.type = query.type;
    delete query.type;
  }

  // ===================================
  // USER / PHONE FILTER (admin only)
  // Admin can filter by a specific
  // receiver userId or phone number.
  // ===================================
  if (isAdminLevel) {
    if (query.userId) {
      baseFilter.user = query.userId;
      delete query.userId;
    } else if (query.phone) {
      const matchedUser = await User.findOne(
        { phone: query.phone },
        { _id: 1 },
      ).lean();

      // if phone exists → filter by that user
      // if not → force empty result
      baseFilter.user = matchedUser
        ? matchedUser._id
        : null;

      delete query.phone;
    }
  }

  // ===================================
  // SEARCH TERM — resolve to user IDs
  // Searches User collection by name or
  // phone and filters notifications by
  // matching receiver IDs only.
  // ===================================
  if (query.searchTerm) {
    const searchTerm = query.searchTerm.trim();

    const matchedUsers = await User.find(
      {
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { phone: { $regex: searchTerm, $options: "i" } },
        ],
      },
      { _id: 1 },
    ).lean();

    if (matchedUsers.length) {
      const ids = matchedUsers.map((u) => u._id);

      // Non-admin is already scoped to own receiver —
      // only keep results if their id is among matched users
      if (baseFilter.user && !Array.isArray(baseFilter.user)) {
        const alreadyScoped = ids.some(
          (id) => id.toString() === baseFilter.user.toString(),
        );
        baseFilter.user = alreadyScoped ? baseFilter.user : null;
      } else {
        baseFilter.user = { $in: ids };
      }
    } else {
      baseFilter.user = null; // no user matched → force empty result
    }

    delete query.searchTerm;
  }

  // BASE QUERY
  const baseQuery = Notification.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(notificationSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("user", "name phone role");

  const meta = await queryBuilder.getMeta();

  const statsMatch: any = { ...buildDateFilter(startDateStr, endDateStr) };

  if (!isAdminLevel) {
    statsMatch.user = user.userId;
  }

  const statsAgg = await Notification.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] } },
        unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, total: 1, read: 1, unread: 1 } },
  ]);

  const stats = statsAgg[0] || { total: 0, read: 0, unread: 0 };

  return {
    data,
    meta,
    stats,
  };
};

const getMyNotifications = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  // Always scoped to the logged-in user only
  const baseFilter: any = {
    user: userId,
    isDeleted: false,
    ...dateFilter,
  };

  // isRead filter (true / false)
  if (query.isRead !== undefined) {
    baseFilter.isRead = query.isRead === "true";
    delete query.isRead;
  }

  // type filter
  if (query.type !== undefined) {
    baseFilter.type = query.type;
    delete query.type;
  }

  const baseQuery = Notification.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(notificationSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  const statsMatch: any = {
    user: userId,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const statsAgg = await Notification.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] } },
        unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, total: 1, read: 1, unread: 1 } },
  ]);

  const stats = statsAgg[0] || { total: 0, read: 0, unread: 0 };

  return { data, meta, stats };
};

const getSingleNotification = async (id: string) => {
  const notification = await Notification.findById(id).populate(
    "user",
    "name phone role"
  );

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return notification;
};

const markAsRead = async (id: string) => {
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return await Notification.findByIdAndUpdate(
    id,
    { isRead: true },
    { returnDocument: "after" }
  );
};

const softDeleteNotification = async (id: string) => {
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return await Notification.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" }
  );
};

const getAllTrashNotifications = async ({
  query,
  user,
}: {
  query: Record<string, string>;
  user: {
    userId: string;
    role: string;
  };
}) => {
  const isAdminLevel =
    user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  const baseFilter: any = { isDeleted: true, ...dateFilter };

  if (!isAdminLevel) {
    baseFilter.user = user.userId;
  }

  if (query.isRead !== undefined) {
    baseFilter.isRead = query.isRead === "true";
    delete query.isRead;
  }

  // type filter
  if (query.type !== undefined) {
    baseFilter.type = query.type;
    delete query.type;
  }

  if (isAdminLevel) {
    if (query.userId) {
      baseFilter.user = query.userId;
      delete query.userId;
    } else if (query.phone) {
      const matchedUser = await User.findOne(
        { phone: query.phone },
        { _id: 1 },
      ).lean();

      baseFilter.user = matchedUser ? matchedUser._id : null;
      delete query.phone;
    }
  }

  if (query.searchTerm) {
    const searchTerm = query.searchTerm.trim();

    const matchedUsers = await User.find(
      {
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { phone: { $regex: searchTerm, $options: "i" } },
        ],
      },
      { _id: 1 },
    ).lean();

    if (matchedUsers.length) {
      const ids = matchedUsers.map((u) => u._id);

      if (baseFilter.user && !Array.isArray(baseFilter.user)) {
        const alreadyScoped = ids.some(
          (id) => id.toString() === baseFilter.user.toString(),
        );
        baseFilter.user = alreadyScoped ? baseFilter.user : null;
      } else {
        baseFilter.user = { $in: ids };
      }
    } else {
      baseFilter.user = null;
    }

    delete query.searchTerm;
  }

  const baseQuery = Notification.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(notificationSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("user", "name phone role");

  const meta = await queryBuilder.getMeta();

  const statsMatch: any = { isDeleted: false, ...buildDateFilter(startDateStr, endDateStr) };

  if (!isAdminLevel) {
    statsMatch.user = user.userId;
  }

  const statsAgg = await Notification.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] } },
        unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, total: 1, read: 1, unread: 1 } },
  ]);

  const stats = statsAgg[0] || { total: 0, read: 0, unread: 0 };

  return { data, meta, stats };
};

const restoreNotification = async (id: string) => {
  const notification = await Notification.findById(id);

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return await Notification.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { returnDocument: "after" }
  );
};

const deleteNotification = async (id: string) => {
  await Notification.findByIdAndDelete(id);

  return null;
};

export const NotificationService = {
  createNotification,
  getAllNotifications,
  getMyNotifications,
  getSingleNotification,
  markAsRead,
  softDeleteNotification,
  getAllTrashNotifications,
  restoreNotification,
  deleteNotification,
};