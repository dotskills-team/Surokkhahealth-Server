import { Router } from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";
import { packageRoutes } from "../modules/package/insurancePackage.route";
import { subscriptionRoutes } from "../modules/subscription/subscription.route";
import { paymentRoutes } from "../modules/payment/payment.route";
import { PartnerRoutes } from "../modules/partner/partner.route";
import { branchRoutes } from "../modules/branch/branch.route";
import { messageRoutes } from "../modules/message/message.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { ContactRoutes } from "../modules/contact/contact.route";
import { ClaimRoutes } from "../modules/claim/claim.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import { consultationRoutes } from "../modules/consultation/consultation.route";

export const router = Router();

const moduleRoutes = [
  {
    path: "/user",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/package",
    route: packageRoutes
  },
  {
    path: "/subscription",
    route: subscriptionRoutes
  },
  {
    path: "/payment",
    route: paymentRoutes
  },
   {
    path: "/partner",
    route: PartnerRoutes
  },
     {
    path: "/branch",
    route: branchRoutes
  },
     {
    path: "/message",
    route: messageRoutes
  },
     {
    path: "/dashboard",
    route: DashboardRoutes
  },
     {
    path: "/notification",
    route: NotificationRoutes
  },
  {
    path: "/contact",
    route: ContactRoutes
  },
  {
    path: "/claim",
    route: ClaimRoutes
  },
  {
    path: "/consultation",
    route: consultationRoutes
  }
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
