/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { NextFunction, Request, Response } from "express";
import { UserServices } from "./user.service";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { IUser } from "./user.interface";
import { sendResponse } from "../../utils/sendResponse";
import { catchAsync } from "../../utils/catchAsync";
import { User } from "./user.model";

const createUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;
    const loggedInUserId = req.user.userId;
    payload.createdBy = loggedInUserId;
    const file = req.file;
    if (file) {
      payload.picture = file.path;
    }

    const user = await UserServices.createUserService(payload);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "User Created Successfully",
      data: user,
    });
  },
);

const getMe = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = req.user as JwtPayload;
    const result = await UserServices.getMe(decodedToken.userId);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Your profile Retrieved Successfully",
      data: result.data,
    });
  },
);

const getMyTrashAgents = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;

  const result = await UserServices.getMyTrashAgents({
    query: req.query as Record<string, string>,
    userId,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "My Trash Agents Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getSingleUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id as string;
    const result = await UserServices.getSingleUser(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User Retrieved Successfully",
      data: result.data,
    });
  },
);

const updateUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id as string;
    const payload: IUser = {
      ...req.body,
      picture: req.file?.path,
    };

    const verifiedToken = req.user;

    const user = await UserServices.updateUser(
      userId,
      payload,
      verifiedToken as JwtPayload,
    );
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "User Updated Successfully",
      data: user,
    });
  },
);

const deleteUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.id as string;
    const result = await UserServices.deleteUser(userId);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "User Deleted Successfully",
      data: result.data,
    });
  },
);

const restoreUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;

  const result = await UserServices.restoreUser(id as string);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User Restored Successfully",
    data: result.data,
  });
});

const permanentDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;

  const result = await UserServices.permanentDeleteUser(id as string);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "User Permanently Deleted Successfully",
    data: result.data,
  });
});

const getAllUsers = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const result = await UserServices.getAllUsers(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All Users Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

const getMyCustomersByLeader = catchAsync(async (req, res) => {
  const result = await UserServices.getMyCustomersByLeader({
    query: req.query as Record<string, string>,
    userId: req.user.userId,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Customers retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getMyTrashCustomers = catchAsync(async (req, res) => {
  const result = await UserServices.getMyTrashCustomers({
    query: req.query as Record<string, string>,
    userId: req.user.userId,
    role: req.user.role,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Trash customers retrieved successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const getAllTrashUsers = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query;
    const result = await UserServices.getAllTrashUsers(
      query as Record<string, string>,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "All Trash Users Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

// Admin / Super Admin — retrieve all agents
const getAllAgents = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllAgents(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Agents Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all trash agents
const getAllTrashAgents = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllTrashAgents(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Trash Agents Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body.data ? JSON.parse(req.body.data) : {};

    if (req.file) {
      payload.picture = (req.file as any).path;
    }

    const verifiedToken = req.user;
    const user = await UserServices.updateProfile(
      payload,
      verifiedToken as JwtPayload,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Profile Updated Successfully",
      data: user,
    });
  },
);

const getAllClaimsManagers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllClaimsManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Claims managers retrieved successfully",
    data: result,
  });
});

const getAllTrashClaimsManagers = catchAsync(async (req, res) => {
  const result = await UserServices.getAllTrashClaimsManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Deleted claims managers retrieved successfully",
    data: result,
  });
});

const updateUserTrash = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  // @ts-expect-error
  const Data = await CommonTrashService(id, User);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Trash Status Updated",
    data: Data,
  });
});

// Admin / Super Admin — retrieve all customers
const getAllCustomers = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;

  const result = await UserServices.getAllCustomers({
    query: req.query as Record<string, string>,
    requesterRole: userId,
  }
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Customers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Agent — own customers (agentId from decoded token)
const getMyCustomers = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;
  const result = await UserServices.getMyCustomers({
    query: req.query as Record<string, string>,
    userId,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "My Customers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Agent Leader — retrieve own agents (id from decoded token)
const getMyAgents = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user as JwtPayload).userId;

  const result = await UserServices.getMyAgents({
    query: req.query as Record<string, string>,
    userId,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "My Agents Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all agent leaders
const getAllAgentLeaders = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllAgentLeaders(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Agent Leaders Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all admins
const getAllAdmins = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllAdmins(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Admins Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all trash admins
const getAllTrashAdmins = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllTrashAdmins(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Trash Admins Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all managers
const getAllManagers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Managers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all trash managers
const getAllTrashManagers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllTrashManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Trash Managers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all managers
const getAllAAManagers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllAAManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Assistant Area Managers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — retrieve all trash managers
const getAllTrashAAManagers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserServices.getAllTrashAAManagers(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "All Trash Assistant Area Managers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Agent Leader — retrieve customers of own agents (id from decoded token)
const getMyAgentLeaderCustomers = catchAsync(
  async (req: Request, res: Response) => {
    const agentLeaderId = (req.user as JwtPayload).userId;
    const requesterRole = (req.user as JwtPayload).role;

    const result = await UserServices.getAllAgentLeaderCustomers({
      query: req.query as Record<string, string>,
      agentLeaderId,
      requesterRole
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Agent Leader Customers Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

// Admin / Super Admin — customers of a specific agent leader (id from route params)
const getAgentLeaderCustomersByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const agentLeaderId = req.params.agentLeaderId as string;
    const requesterRole = (req.user as JwtPayload).role;
    const result = await UserServices.getAllAgentLeaderCustomers({
      query: req.query as Record<string, string>,
      agentLeaderId,
      requesterRole,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Agent Leader Customers Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

// Agent — own customers (agentId from decoded token)
const getMyAgentCustomers = catchAsync(async (req: Request, res: Response) => {
  const decoded = req.user as JwtPayload;
  const result = await UserServices.getCustomersByAgent({
    query: req.query as Record<string, string>,
    agentId: decoded.userId,
    requesterId: decoded.userId,
    requesterRole: decoded.role,
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Agent Customers Retrieved Successfully",
    data: result.data,
    meta: result.meta,
    stats: result.stats,
  });
});

// Admin / Super Admin — any agent's customers (agentId from route params)
const getAgentCustomersByAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const decoded = req.user as JwtPayload;
    const agentId = req.params.agentId as string;

    const result = await UserServices.getCustomersByAgent({
      query: req.query as Record<string, string>,
      agentId,
      requesterId: decoded.userId,
      requesterRole: decoded.role,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Agent Customers Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

// Agent Leader — customers of an agent under their leadership (agentId from params, ownership validated)
const getAgentCustomersByLeader = catchAsync(
  async (req: Request, res: Response) => {
    const decoded = req.user as JwtPayload;
    const agentId = req.params.agentId as string;

    const result = await UserServices.getCustomersByAgent({
      query: req.query as Record<string, string>,
      agentId,
      requesterId: decoded.userId,
      requesterRole: decoded.role,
    });

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Agent Customers Retrieved Successfully",
      data: result.data,
      meta: result.meta,
      stats: result.stats,
    });
  },
);

export const UserControllers = {
  createUser,
  getMe,
  getAllUsers,
  getAllTrashUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  updateProfile,
  updateUserTrash,
  restoreUser,
  permanentDeleteUser,
  getAllCustomers,
  getMyCustomers,
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
  getMyAgentLeaderCustomers,
  getAgentLeaderCustomersByAdmin,
  getMyTrashAgents,
  getMyCustomersByLeader,
  getMyTrashCustomers,
  getAllTrashClaimsManagers,
  getAllClaimsManagers,
  getMyAgentCustomers,
  getAgentCustomersByAdmin,
  getAgentCustomersByLeader,
};
