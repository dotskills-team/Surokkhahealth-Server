import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";

const router = Router();

router.post("/create-notification", checkAuth(...Object.values(Role)), NotificationController.createNotification);

router.get("/all-notifications", checkAuth(...Object.values(Role)), NotificationController.getAllNotifications);

router.get("/my-notifications", checkAuth(...Object.values(Role)), NotificationController.getMyNotifications); 

router.get("/all-trash-notifications", checkAuth(...Object.values(Role)), NotificationController.getAllTrashNotifications);

router.get("/:id", checkAuth(...Object.values(Role)), NotificationController.getSingleNotification);

router.patch("/:id/read", checkAuth(...Object.values(Role)), NotificationController.markAsRead);

router.patch("/restore/:id", checkAuth(...Object.values(Role)), NotificationController.restoreNotification);

router.delete("/:id", checkAuth(...Object.values(Role)), NotificationController.softDeleteNotification);

router.delete("/permanent/:id", checkAuth(...Object.values(Role)), NotificationController.deleteNotification);

export const NotificationRoutes = router;