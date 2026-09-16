
export const buildSubscriptionQuery = (query: Record<string, string>) => {
  const queryObj: any = {};

  const dateType = query.dateType || "created";

  const dateFieldMap: Record<string, string> = {
    created: "createdAt",
    updatedAt: "updatedAt",
    startDate: "startDate",
    endDate: "endDate",
  };

  const dateField = dateFieldMap[dateType] || "createdAt";

  const hasDateFilter = query.startDate || query.endDate;

  if (hasDateFilter) {
    queryObj[dateField] = {};

    if (query.startDate) {
      queryObj[dateField].$gte = new Date(query.startDate);
    }

    if (query.endDate) {
      queryObj[dateField].$lte = new Date(query.endDate);
    }
  }

  if (query.status) queryObj.status = query.status;
  if (query.paymentStatus) queryObj.paymentStatus = query.paymentStatus;

  delete query.startDate;
  delete query.endDate;
  delete query.dateType;

  return { queryObj, dateField, hasDateFilter };
};