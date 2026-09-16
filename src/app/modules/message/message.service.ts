
import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { Message } from "./message.model";
import { MessageType } from "./message.interface";
import { messageSearchableFields } from "./message.constants";
import { User } from "../user/user.model";


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

// builds { total, byType: { SUBSCRIPTION: n, PAYMENT: n, ... } } for a given match filter
const buildTypeStats = async (matchFilter: Record<string, any>) => {
  const statsAgg = await Message.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);

  const byType = Object.values(MessageType).reduce(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<MessageType, number>,
  );

  let total = 0;

  statsAgg.forEach((row) => {
    const type = row._id as MessageType | null;
    if (type && byType[type] !== undefined) {
      byType[type] = row.count;
    }
    total += row.count;
  });

  return { total, byType };
};

const createMessage = async (
  payload: {
    message: string;
    phone: string;
    type?: MessageType;
  },
) => {
  const result = await Message.create(payload);
  return result;
};

const getAllMessages = async (query: Record<string, string>) => {
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  const filter: Record<string, any> = { isDeleted: false, ...dateFilter };

  if (query.type) {
    filter.type = query.type;
    delete query.type;
  }

  const baseQuery = Message.find(filter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(messageSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()

  const meta = await queryBuilder.getMeta();

  const stats = await buildTypeStats({ isDeleted: false, ...dateFilter });

  return {
    data,
    meta,
    stats,
  };
};


// GET SINGLE MESSAGE
const getSingleMessage = async (id: string) => {
  const message = await Message.findById(id);

  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  return message;
};

const getMyMessages = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  // Message model has no `user` relation — only `phone`.
  // So resolve the logged-in user's phone first, then filter by it.
  const currentUser = await User.findById(userId, { phone: 1 }).lean();

  if (!currentUser?.phone) {
    // No phone on file → nothing can match, return empty result safely
    return {
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPage: 0 },
      stats: { total: 0 },
    };
  }

  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  const baseFilter: any = {
    phone: currentUser.phone,
    isDeleted: false,
    ...dateFilter,
  };

  // type filter
  if (query.type !== undefined) {
    baseFilter.type = query.type;
    delete query.type;
  }

  const baseQuery = Message.find(baseFilter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(messageSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  const statsMatch: any = {
    phone: currentUser.phone,
    isDeleted: false,
    ...buildDateFilter(startDateStr, endDateStr),
  };

  const statsAgg = await Message.aggregate([
    { $match: statsMatch },
    { $group: { _id: null, total: { $sum: 1 } } },
    { $project: { _id: 0, total: 1 } },
  ]);

  const stats = statsAgg[0] || { total: 0 };

  return { data, meta, stats };
};

// UPDATE MESSAGE
const updateMessage = async (
  id: string,
  payload: Partial<{ message: string; phone: string; type: MessageType }>,
) => {
  const exists = await Message.findById(id);

  if (!exists) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  return await Message.findByIdAndUpdate(id, payload, {
    returnDocument: "after",
    runValidators: true,
  });
};

// SOFT DELETE MESSAGE
const softDeleteMessage = async (id: string) => {
  const message = await Message.findById(id);

  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  return await Message.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );
};

// HARD DELETE MESSAGE
const deleteMessage = async (id: string) => {
  await Message.findByIdAndDelete(id);
  return null;
};


// GET ALL TRASH MESSAGES
const getAllTrashMessages = async (query: Record<string, string>) => {
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];
  const dateFilter = buildDateFilter(startDateStr, endDateStr);

  delete query.startDate;
  delete query.endDate;

  const filter: Record<string, any> = { isDeleted: true, ...dateFilter };

  if (query.type) {
    filter.type = query.type;
    delete query.type;
  }

  const baseQuery = Message.find(filter);

  const queryBuilder = new QueryBuilder(baseQuery, query);
  const data = await queryBuilder
    .search(messageSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
  const meta = await queryBuilder.getMeta();

  const stats = await buildTypeStats({ isDeleted: true, ...dateFilter });

  return {
    data,
    meta,
    stats,
  };
};

// RESTORE MESSAGE
const restoreMessage = async (id: string) => {
  const message = await Message.findById(id);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }
  return await Message.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { returnDocument: "after" },
  );
};

export const MessageService = {
  createMessage,
  getAllMessages,
  getMyMessages,
  getSingleMessage,
  updateMessage,
  softDeleteMessage,
  deleteMessage,
  getAllTrashMessages,
  restoreMessage,
};