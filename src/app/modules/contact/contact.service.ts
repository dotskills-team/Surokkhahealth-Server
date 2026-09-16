import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Contact } from "./contact.model";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { contactSearchableFields } from "./contact.constants";

const createContact = async (payload: any) => {
  return await Contact.create(payload);
};

// =========================
// GET ALL CONTACTS
// =========================
// const getAllContacts = async ({
//   query,
//   user,
// }: {
//   query: Record<string, string>;
//   user: {
//     userId: string;
//     role: string;
//   };
// }) => {
//   const filter: any = { isDeleted: false };

//   // ROLE BASED ACCESS
//   const isAdmin =
//     user.role === "SUPER_ADMIN" || user.role === "ADMIN";

//   if (!isAdmin) {
//     filter.userId = user.userId;
//   }

//   // FILTERS
//   if (query.isRead !== undefined) {
//     filter.isRead = query.isRead === "true";
//     delete query.isRead;
//   }

//   if (query.isReplied !== undefined) {
//     filter.isReplied = query.isReplied === "true";
//     delete query.isReplied;
//   }

//   if (query.phone) {
//     filter.phone = query.phone;
//     delete query.phone;
//   }

//   const baseQuery = Contact.find(filter);

//   const queryBuilder = new QueryBuilder(baseQuery, query);

//   const data = await queryBuilder
//     .search(contactSearchableFields)
//     .filter()
//     .sort()
//     .fields()
//     .paginate()
//     .build()
//     .populate("userId", "name phone role")
//     .populate("relatedPackage", "name")
//     .populate("relatedPartner", "name logo");

//   const meta = await queryBuilder.getMeta();

//   // STATS
//   const stats = await Contact.aggregate([
//     { $match: filter },
//     {
//       $group: {
//         _id: null,
//         total: { $sum: 1 },
//         read: { $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] } },
//         unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
//         replied: { $sum: { $cond: [{ $eq: ["$isReplied", true] }, 1, 0] } },
//       },
//     },
//   ]);

//   return {
//     data,
//     meta,
//     stats: stats[0] || {
//       total: 0,
//       read: 0,
//       unread: 0,
//       replied: 0,
//     },
//   };
// };

// =========================================================
// DATE FILTER HELPERS (same pattern as subscription.service.ts)
// =========================================================

const dateFieldMap: Record<string, string> = {
  created: "createdAt",
  updatedAt: "updatedAt",
};

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

// dateType given (created / updatedAt) -> range/exact-day filter on that field
// dateType NOT given -> default to filtering on createdAt
const buildDateFilterObject = (
  dateType: string | undefined,
  startDateStr?: string,
  endDateStr?: string,
): Record<string, { $gte?: Date; $lte?: Date }> => {
  const result: Record<string, { $gte?: Date; $lte?: Date }> = {};

  const field =
    dateType && dateFieldMap[dateType] ? dateFieldMap[dateType] : "createdAt";

  const range = buildDateRangeFilter(startDateStr, endDateStr);

  if (range) {
    result[field] = range;
  }

  return result;
};

const buildContactDateFilter = (query: Record<string, string>) => {
  const dateType = query.dateType;
  const startDateStr = query["startDate"];
  const endDateStr = query["endDate"];

  const dateFilter = buildDateFilterObject(dateType, startDateStr, endDateStr);

  // remove special fields so QueryBuilder doesn't choke on them
  delete query.startDate;
  delete query.endDate;
  delete query.dateType;

  return { dateFilter, dateType, startDateStr, endDateStr };
};

// =========================================================
// getAllContacts — with date filter added
// =========================================================

const getAllContacts = async ({
  query,
  user,
}: {
  query: Record<string, string>;
  user: {
    userId: string;
    role: string;
  };
}) => {
  const filter: any = { isDeleted: false };

  // ROLE BASED ACCESS
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  if (!isAdmin) {
    filter.userId = user.userId;
  }

  // FILTERS
  if (query.isRead !== undefined) {
    filter.isRead = query.isRead === "true";
    delete query.isRead;
  }

   if (query.isReplied !== undefined) {
    filter.isReplied = query.isReplied === "true";
    delete query.isReplied;
  }

  if (query.phone) {
    filter.phone = query.phone;
    delete query.phone;
  }

  // DATE FILTER (must run before QueryBuilder so query object is cleaned)
  const { dateFilter, dateType, startDateStr, endDateStr } =
    buildContactDateFilter(query);

  Object.assign(filter, dateFilter);

  const baseQuery = Contact.find(filter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(contactSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("userId", "name phone role")
    .populate("relatedPackage", "name")
    .populate("relatedPartner", "name logo");

  const meta = await queryBuilder.getMeta();

  // STATS — reuse same base filter (role + date) but drop
  // one-off UI filters (isRead/phone) already removed from `filter`
  // above are still needed for stats scoping, so match on `filter` as-is
  const statsMatch = {
    isDeleted: filter.isDeleted,
    ...(filter.userId && { userId: filter.userId }),
    ...dateFilter,
  };

  const stats = await Contact.aggregate([
    { $match: statsMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ["$isRead", true] }, 1, 0] } },
        unread: { $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] } },
        replied: { $sum: { $cond: [{ $eq: ["$isReplied", true] }, 1, 0] } },
      },
    },
  ]);

  return {
    data,
    meta,
    stats: stats[0] || {
      total: 0,
      read: 0,
      unread: 0,
      replied: 0,
    },
  };
};

// GET ALL TRASH 
const getAllTrashContacts = async ({
  query,
}: {
  query: Record<string, string>;
}) => {
  const filter = {
    isDeleted: true,
  };

  const baseQuery = Contact.find(filter);

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .search(contactSearchableFields)
    .filter()
    .sort()
    .fields()
    .paginate()
    .build();

  const meta = await queryBuilder.getMeta();

  return {
    data,
    meta,
  };
};

const getSingleContact = async (id: string) => {
  const data = await Contact.findById(id)
    .populate("userId", "name phone")
    .populate("relatedPackage")
    .populate("relatedPartner");

  if (!data) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact not found");
  }

  return data;
};

const markAsRead = async (id: string) => {
  const data = await Contact.findByIdAndUpdate(
    id,
    { isRead: true },
    { returnDocument: "after" },
  );

  return data;
};

const markAsReplied = async (id: string) => {
  const data = await Contact.findByIdAndUpdate(
    id,
    { isReplied: true },
    { returnDocument: "after" },
  );

  return data;
};

const softDeleteContact = async (id: string) => {
  const data = await Contact.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { returnDocument: "after" },
  );

  return data;
};

// HARD DELETE 
const deleteContact = async (id: string) => {
  await Contact.findByIdAndDelete(id);
  return null;
};




// RESTORE 
const restoreContact = async (id: string) => {
  const message = await Contact.findById(id);
  if (!message) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }
  return await Contact.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { returnDocument: "after" },
  );
};

export const ContactService = {
  createContact,
  getAllContacts,
  getSingleContact,
  markAsRead,
  markAsReplied,
  softDeleteContact,
  deleteContact,
  getAllTrashContacts,
  restoreContact,
};