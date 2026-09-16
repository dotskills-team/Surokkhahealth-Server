import express from "express";
import { MessageController } from "./message.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = express.Router();

router.post(
  "/create-message",
  MessageController.createMessage
);

router.get(
  "/all-messages",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.getAllMessages
);

router.get("/my-messages",
  checkAuth(...Object.values(Role)),
  MessageController.getMyMessages);

router.get(
  "/all-trash-messages",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.getAllTrashMessages
);

router.get(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.getSingleMessage
);

router.patch(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.updateMessage
);

router.patch(
  "/restore/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.restoreMessage
);

router.delete(
  "/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.softDeleteMessage
);

router.delete(
  "/permanent/:id",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  MessageController.deleteMessage
);

export const messageRoutes = router;