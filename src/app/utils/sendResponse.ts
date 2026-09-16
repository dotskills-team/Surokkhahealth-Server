// import { Response } from "express";

// interface TMeta {
//   total: number;
// }

// interface TResponse<T> {
//   statusCode: number;
//   message: string;
//   success: boolean;
//   data: T;
//   meta?: TMeta;
//   stats?: {
//     total: number;
//     PENDING: number;
//     CONFIRMED: number;
//     COMPLETED: number;
//     CANCELLED: number;
//   };
// }

// export const sendResponse = <T>(res: Response, data: TResponse<T>) => {
//   res.status(data.statusCode).json({
//     statusCode: data.statusCode,
//     success: data.success,
//     message: data.message,
//     data: data.data,
//     meta: data.meta,
//     stats: data.stats,
//   });
// };



import { Response } from "express";

interface TMeta {
  total: number;
  [key: string]: any;
}

interface TResponse<T> {
  statusCode: number;
  message: string;
  success: boolean;
  data: T;
  meta?: TMeta;
  stats?: Record<string, any>;
}

export const sendResponse = <T>(
  res: Response,
  data: TResponse<T>,
) => {
  res.status(data.statusCode).json({
    statusCode: data.statusCode,
    success: data.success,
    message: data.message,
    data: data.data,
    meta: data.meta,
    stats: data.stats,
  });
};