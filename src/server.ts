/* eslint-disable no-console */
import { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { envVars } from "./app/config/env";
import { seedAdmin } from "./app/utils/seedAdmin";
import { registerSubscriptionExpireTracker } from "./app/utils/subscriptionExpireTracker";
import { startSurjoPayRefundCron } from "./app/utils/surjopayRefundTracker";
let server: Server;

const startServer = async () => {
  try {
    await mongoose.connect(envVars.DB_URL);
    console.log("Mongoose is connected!!!");

    await seedAdmin();

    server = app.listen(envVars.PORT, () => {
      console.log(`Insurance management server is running on port ${envVars.PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
};

startServer();

registerSubscriptionExpireTracker();
startSurjoPayRefundCron();

process.on("unhandledRejection", (err) => {
  console.log("uncaught error detected.... server shutting down", err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
});

process.on("uncaughtException", (err) => {
  console.log("uncaught error detected.... server shutting down", err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
});

process.on("SIGTERM", () => {
  console.log("Sigterm signal received.... server shutting down");
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
});

process.on("SIGINT", () => {
  console.log("Sigint signal received.... server shutting down");
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  }
});
