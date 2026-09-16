
import cron from "node-cron";
import { Subscription } from "../modules/subscription/subscription.model";
import { SubscriptionStatus } from "../modules/subscription/subscription.interface";
import { Notification } from "../modules/notification/notification.model";
import { NotificationType } from "../modules/notification/notification.interface";
import { sendSMS } from "../utils/sendSms";
import { MessageType } from "../modules/message/message.interface";

// ─── HELPERS ────────────────────────────────────────────────────────────────

// Returns the UTC window for a calendar day that is `daysFromNow` days
// ahead of today (midnight-to-midnight so timezone drift cannot cause
// a reminder to be skipped or doubled).
const getFutureDayWindow = (daysFromNow: number) => {
  const now = new Date();

  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromNow,
      0, 0, 0, 0,
    ),
  );

  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromNow,
      23, 59, 59, 999,
    ),
  );

  return { start, end };
};

// ─── REMINDER JOB ───────────────────────────────────────────────────────────

// Finds all ACTIVE subscriptions whose endDate falls exactly `daysAhead`
// days from today and sends a reminder notification + SMS to each customer.
// Skips customers who already received the same reminder today to prevent
// duplicates when the job is re-run (e.g. after a server restart).
const sendExpiryReminders = async (daysAhead: number) => {
  const { start, end } = getFutureDayWindow(daysAhead);

  const subscriptions = await Subscription.find({
    status: SubscriptionStatus.ACTIVE,
    isDeleted: false,
    isLifetime: { $ne: true },
    endDate: { $gte: start, $lte: end },
  }).populate("customer", "_id name phone");

  if (!subscriptions.length) return;

  // Guard against duplicates — skip users who already got this reminder today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const alreadyNotified = await Notification.find({
    type: NotificationType.SUBSCRIPTION_EXPIRING,
    createdAt: { $gte: todayStart },
    user: { $in: subscriptions.map((s) => (s.customer as any)._id) },
  }).select("user");

  const alreadyNotifiedIds = new Set(
    alreadyNotified.map((n) => n.user.toString()),
  );

  const pending = subscriptions.filter(
    (sub) => !alreadyNotifiedIds.has((sub.customer as any)._id.toString()),
  );

  if (!pending.length) {
    console.log(
      `[ExpiryTracker] ${daysAhead}-day reminder: all customers already notified today, skipping.`,
    );
    return;
  }

  const message =
    daysAhead === 1
      ? "Your subscription expires tomorrow. Renew now to avoid interruption."
      : `Your subscription expires in ${daysAhead} days. Please renew to continue enjoying uninterrupted coverage.`;

  await Notification.insertMany(
    pending.map((sub) => ({
      user: (sub.customer as any)._id,
      title: "Subscription Expiry Reminder",
      message,
      type: NotificationType.SUBSCRIPTION_EXPIRING,
    })),
  );

  await Promise.allSettled(
    pending.map((sub) =>
      sendSMS((sub.customer as any).phone, message, MessageType.SUBSCRIPTION),

    ),
  );

  console.log(
    `[ExpiryTracker] Sent ${pending.length} ${daysAhead}-day reminder(s).`,
  );
};

// ─── EXPIRE JOB ─────────────────────────────────────────────────────────────

// Finds all ACTIVE subscriptions whose endDate has already passed and:
//   1. Sets status → EXPIRED, isActive → false
//   2. Sends an expiry notification + SMS to each customer
// No duplicate guard needed — once marked EXPIRED the query won't match again.
const processExpiredSubscriptions = async () => {
  const now = new Date();

  const expiredSubscriptions = await Subscription.find({
    status: SubscriptionStatus.ACTIVE,
    isDeleted: false,
    isLifetime: { $ne: true },
    endDate: { $lt: now },
  }).populate("customer", "_id name phone");

  if (!expiredSubscriptions.length) return;

  const ids = expiredSubscriptions.map((sub) => sub._id);

  // Bulk-update all expired subscriptions in one query
  await Subscription.updateMany(
    { _id: { $in: ids } },
    {
      status: SubscriptionStatus.EXPIRED,
      isActive: false,
    },
  );

  const message =
    "Your subscription has expired. Please renew to continue enjoying our services.";

  await Notification.insertMany(
    expiredSubscriptions.map((sub) => ({
      user: (sub.customer as any)._id,
      title: "Subscription Expired",
      message,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
    })),
  );

  await Promise.allSettled(
    expiredSubscriptions.map((sub) =>
      sendSMS((sub.customer as any).phone, message, MessageType.SUBSCRIPTION),
    ),
  );

  console.log(
    `[ExpiryTracker] Expired ${ids.length} subscription(s) and sent notifications.`,
  );
};

// ─── CRON REGISTRATION ──────────────────────────────────────────────────────
//
// Runs once every night at 23:59 (server local time).
// Order matters — expire job runs first so a subscription that expires
// tonight is marked EXPIRED before the reminder jobs check it.
//
//  23:59  1. mark expired + notify + SMS
//         2. 7-day reminders + SMS
//         3. 3-day reminders + SMS
//         4. 1-day reminders + SMS

export const registerSubscriptionExpireTracker = () => {
  cron.schedule("59 23 * * *", async () => {
    console.log("[ExpiryTracker] Running nightly jobs...");

    try {
      await processExpiredSubscriptions();
    } catch (err) {
      console.error("[ExpiryTracker] Expire job failed:", err);
    }

    try {
      await sendExpiryReminders(7);
    } catch (err) {
      console.error("[ExpiryTracker] 7-day reminder failed:", err);
    }

    try {
      await sendExpiryReminders(3);
    } catch (err) {
      console.error("[ExpiryTracker] 3-day reminder failed:", err);
    }

    try {
      await sendExpiryReminders(1);
    } catch (err) {
      console.error("[ExpiryTracker] 1-day reminder failed:", err);
    }

    console.log("[ExpiryTracker] Nightly jobs completed.");
  });

  console.log("[ExpiryTracker] Registered — runs nightly at 23:59.");
};