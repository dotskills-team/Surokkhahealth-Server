import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SubscriptionServices } from "./subscription.service";
import { SubscriptionAnalyticsService } from "./subscription.analytics.service";

const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const role = (req as any).user.role;

  const result = await SubscriptionServices.createSubscription(
    req.body,
    userId,
    role,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Subscription created successfully",
    data: result,
  });
});

const getAllSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;

  const result = await SubscriptionServices.getAllSubscriptions(
    query as Record<string, string>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All subscriptions retrieved successfully",
    data: result,
  });
});

const getAgentsAllSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;
    const userId = req.params.id as string;

    const result = await SubscriptionServices.getAllSubscriptionsByAgent({
      query: query as Record<string, string>,
      userId,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All subscriptions retrieved successfully",
      data: result,
    });
  },
);

const getAgentLeaderSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;
    const userId = (req as any).user.userId;

    const result = await SubscriptionServices.getAgentLeaderSubscriptions({
      query: query as Record<string, string>,
      userId,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Agent leader team subscriptions retrieved successfully",
      data: result,
    });
  },
);

const getMyTrashSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;
    const userId = req.user?.userId;

    const result = await SubscriptionServices.getMyTrashSubscriptions({
      query: query as Record<string, string>,
      userId,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "My trash subscriptions retrieved successfully",
      data: result,
    });
  },
);

const getAgentLeaderTrashSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;
    const userId = req.user?.userId;

    const result = await SubscriptionServices.getAgentLeaderTrashSubscriptions({
      query: query as Record<string, string>,
      userId,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Agent leader trash subscriptions retrieved successfully",
      data: result,
    });
  },
);

const restoreSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionServices.restoreSubscription(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription restored successfully",
    data: result,
  });
});

const permanentDeleteSubscription = catchAsync(
  async (req: Request, res: Response) => {
    await SubscriptionServices.permanentDeleteSubscription(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscription permanently deleted successfully",
      data: null,
    });
  },
);

const getAgentLeaderSubscriptionsByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;
    const leaderId = req.params.id as string;

    const result = await SubscriptionServices.getAgentLeaderSubscriptions({
      query: query as Record<string, string>,
      userId: leaderId,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Agent leader subscriptions retrieved successfully (Admin)",
      data: result,
    });
  },
);

const getMySubscriptions = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const userId = req?.user?.userId;

  const result = await SubscriptionServices.getMySubscriptions({
    query: query as Record<string, string>,
    userId,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My all subscriptions retrieved successfully",
    data: result,
  });
});

const getAllTrashSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;

    const result = await SubscriptionServices.getAllTrashSubscriptions(
      query as Record<string, string>,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "All trash subscriptions retrieved successfully",
      data: result,
    });
  },
);

const getSingleSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SubscriptionServices.getSingleSubscription(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscription retrieved successfully",
      data: result,
    });
  },
);

const softDeleteSubscription = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SubscriptionServices.softDeleteSubscription(
      req.params.id as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Subscription deleted successfully",
      data: result,
    });
  },
);

const updateSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await SubscriptionServices.updateSubscription(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription updated successfully",
    data: result,
  });
});

const getCustomerSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const customerId = req.params.customerId as string;
    const requesterId = (req as any).user.userId;
    const requesterRole = (req as any).user.role;

    const result = await SubscriptionServices.getCustomerSubscriptions({
      customerId,
      requesterId,
      requesterRole,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Customer subscriptions retrieved successfully",
      data: result,
    });
  },
);

const getAdminOverview = catchAsync(async (req, res) => {
  const result = await SubscriptionAnalyticsService.getAdminOverview();

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Overview retrieved successfully",
    data: result,
  });
});

const getAgentLeaderOverview = catchAsync(async (req, res) => {
  const result = await SubscriptionAnalyticsService.getAgentLeaderOverview(
    req.user.userId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Overview retrieved successfully",
    data: result,
  });
});

const getAgentOverview = catchAsync(async (req, res) => {
  const result = await SubscriptionAnalyticsService.getAgentOverview(
    req.user.userId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Overview retrieved successfully",
    data: result,
  });
});

export const SubscriptionControllers = {
  createSubscription,
  getSingleSubscription,
  softDeleteSubscription,
  updateSubscription,
  getAllSubscriptions,
  getAllTrashSubscriptions,
  getAgentsAllSubscriptions,
  getMySubscriptions,
  getMyTrashSubscriptions,
  getAdminOverview,
  getAgentLeaderOverview,
  getAgentOverview,
  permanentDeleteSubscription,
  restoreSubscription,
  getAgentLeaderSubscriptions,
  getAgentLeaderTrashSubscriptions,
  getAgentLeaderSubscriptionsByAdmin,
  getCustomerSubscriptions,
};
