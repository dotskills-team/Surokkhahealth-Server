import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import {
  ConsultationStatus,
  PrescriptionStatus,
} from "./consultation.interface";
import { consultationSearchableFields } from "./consultation.constants";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { User } from "../user/user.model";
import { Subscription } from "../subscription/subscription.model";
import { Consultation } from "./consultation.model";
import { SubscriptionStatus } from "../subscription/subscription.interface";
import { ZaynaxApi } from "../zaynax/zaynax.service";

const CALLBACK_ELIGIBLE_STATUSES = [
  ConsultationStatus.PAID,
  ConsultationStatus.RINGING,
  ConsultationStatus.REJECTED,
  ConsultationStatus.TIMEOUT,
];

const LIVE_CALL_STATUSES = [
  ConsultationStatus.ACCEPTED,
  ConsultationStatus.RINGING,
];
const MAX_CALL_DURATION_MS = 60 * 60 * 1000;
const computeAndPersistDuration = async (consultation: any) => {
  if (consultation.callStartedAt && consultation.callEndedAt) {
    const ms =
      consultation.callEndedAt.getTime() - consultation.callStartedAt.getTime();
    consultation.callDurationSeconds = Math.max(0, Math.round(ms / 1000));
  }
};

interface IUpdateConsultationStatusPayload {
  status: ConsultationStatus;
  callStartedAt?: string;
  callEndedAt?: string;
  prescriptionUrl?: string;
}

const updateConsultationStatus = async (
  id: string,
  payload: IUpdateConsultationStatusPayload,
) => {
  const consultation = await Consultation.findById(id).select("+zaynaxToken");

  if (!consultation) {
    throw new AppError(httpStatus.NOT_FOUND, "Consultation not found");
  }
  const alreadyTerminal =
    consultation.status === ConsultationStatus.COMPLETED ||
    consultation.status === ConsultationStatus.CANCELLED;

  if (alreadyTerminal && payload.status === ConsultationStatus.COMPLETED) {
    return consultation;
  }

  consultation.status = payload.status;
  if (payload.callStartedAt)
    consultation.callStartedAt = new Date(payload.callStartedAt);
  if (payload.callEndedAt)
    consultation.callEndedAt = new Date(payload.callEndedAt);
  if (payload.prescriptionUrl) {
    consultation.prescriptionUrl = payload.prescriptionUrl;
    consultation.prescriptionStatus = PrescriptionStatus.READY;
  }

  await computeAndPersistDuration(consultation);

  if (payload.status === ConsultationStatus.COMPLETED) {
    if (!consultation.callEndedAt) {
      consultation.callEndedAt = new Date();
      await computeAndPersistDuration(consultation);
    }
    if (!consultation.prescriptionUrl) {
      consultation.prescriptionStatus = PrescriptionStatus.PENDING;
    }
  }

  await consultation.save();
  if (
    payload.status === ConsultationStatus.COMPLETED &&
    consultation.prescriptionStatus === PrescriptionStatus.PENDING
  ) {
    schedulePrescriptionPoll(String(consultation._id));
  }

  return consultation;
};

const PRESCRIPTION_MAX_ATTEMPTS = 8;
const PRESCRIPTION_BACKOFF_MS = [
  10_000, 20_000, 30_000, 60_000, 120_000, 180_000, 300_000, 300_000,
];

const schedulePrescriptionPoll = (consultationId: string, attempt = 1) => {
  const delay =
    PRESCRIPTION_BACKOFF_MS[
      Math.min(attempt - 1, PRESCRIPTION_BACKOFF_MS.length - 1)
    ];
  setTimeout(() => {
    attemptPrescriptionSync(consultationId, attempt).catch((err) =>
      console.error(
        "[prescriptionPoll] unexpected failure:",
        consultationId,
        err,
      ),
    );
  }, delay);
};

const attemptPrescriptionSync = async (
  consultationId: string,
  attempt: number,
) => {
  const consultation =
    await Consultation.findById(consultationId).select("+zaynaxToken");

  if (
    !consultation ||
    consultation.prescriptionStatus === PrescriptionStatus.READY
  ) {
    return;
  }

  if (!consultation.zaynaxToken || !consultation.zaynaxBookingId) {
    consultation.prescriptionStatus = PrescriptionStatus.FAILED;
    await consultation.save();
    return;
  }

  consultation.prescriptionAttempts = attempt;
  consultation.lastPrescriptionCheckAt = new Date();

  try {
    const details = await ZaynaxApi.getBookingDetails(
      consultation.zaynaxToken,
      consultation.zaynaxBookingId,
    );
    const prescriptionUrl = ZaynaxApi.extractPrescriptionUrl(
      details.prescriptions,
    );

    if (prescriptionUrl) {
      consultation.prescriptionUrl = prescriptionUrl;
      consultation.prescriptionStatus = PrescriptionStatus.READY;
      // consultation.zaynaxToken = undefined;
      await consultation.save();
      return;
    }
  } catch (err) {
    console.error(
      "[prescriptionPoll] Zaynax call failed:",
      consultationId,
      err,
    );
  }

  if (attempt >= PRESCRIPTION_MAX_ATTEMPTS) {
    consultation.prescriptionStatus = PrescriptionStatus.FAILED;
    await consultation.save();
    return;
  }

  await consultation.save();
  schedulePrescriptionPoll(consultationId, attempt + 1);
};

const reconcileStaleConsultations = async () => {
  const cutoff = new Date(Date.now() - MAX_CALL_DURATION_MS);

  const stale = await Consultation.find({
    status: { $in: LIVE_CALL_STATUSES },
    callStartedAt: { $lte: cutoff },
    isDeleted: false,
  }).select("+zaynaxToken");

  for (const consultation of stale) {
    consultation.status = ConsultationStatus.COMPLETED;
    consultation.callEndedAt = consultation.callEndedAt ?? new Date();
    await computeAndPersistDuration(consultation);
    if (!consultation.prescriptionUrl) {
      consultation.prescriptionStatus = PrescriptionStatus.PENDING;
    }
    await consultation.save();

    if (consultation.prescriptionStatus === PrescriptionStatus.PENDING) {
      schedulePrescriptionPoll(String(consultation._id));
    }
  }

  return { reconciled: stale.length };
};

const fetchPrescription = async (id: string) => {
  const consultation = await Consultation.findById(id).select("+zaynaxToken");

  if (!consultation) {
    throw new AppError(httpStatus.NOT_FOUND, "Consultation not found");
  }

  if (consultation.prescriptionUrl) {
    return { prescriptionUrl: consultation.prescriptionUrl, ready: true };
  }

  if (!consultation.zaynaxToken || !consultation.zaynaxBookingId) {
    return { prescriptionUrl: null, ready: false };
  }

  const details = await ZaynaxApi.getBookingDetails(
    consultation.zaynaxToken,
    consultation.zaynaxBookingId,
  );
  const prescriptionUrl = ZaynaxApi.extractPrescriptionUrl(
    details.prescriptions,
  );

  if (!prescriptionUrl) {
    return { prescriptionUrl: null, ready: false };
  }

  consultation.prescriptionUrl = prescriptionUrl;
  consultation.prescriptionStatus = PrescriptionStatus.READY;
  // consultation.zaynaxToken = undefined;
  await consultation.save();

  return { prescriptionUrl, ready: true };
};

const waitForDoctorAssignment = async (
  token: string,
  bookingId: string,
  maxAttempts = 10,
  delayMs = 3000,
): Promise<{
  id: string;
  doctorID: string;
  patientID: string;
  doctorInfo: {
    firstName: { en: string; bn: string };
    lastName: { en: string; bn: string };
    image: string;
  };
}> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const details = await ZaynaxApi.getBookingDetails(token, bookingId);

    if (details.doctorID && details.doctorInfo) {
      return details as any;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Doctor assignment timed out — please try again shortly");
};

const genderMap = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
} as const;

const initiateConsultation = async (userId: string) => {
  const customer = await User.findById(userId);

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  // Any active subscription works as the reference — this module doesn't
  // gate on a per-package consultation limit right now, it only records usage.
  const subscription = await Subscription.findOne({
    customer: userId,
    isDeleted: false,
    status: SubscriptionStatus.ACTIVE,
  });

  if (!subscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No active subscription found for this customer",
    );
  }

  const consultation = await Consultation.create({
    customer: userId,
    subscription: subscription._id,
    status: ConsultationStatus.INITIATED,
  });

  console.log("Initiated consultation", consultation._id);

  try {
    // Activate/refresh this patient's Zaynax record under the shared corporate account.
    const clientSideAppointmentId = String(consultation._id);

    const subscribeRes = await ZaynaxApi.subscribeCorporatePackage(
      clientSideAppointmentId,
      process.env.SUROKKHA_LOGO_URL as string,
      [
        {
          firstName: customer.name?.split(" ")[0] ?? customer.name,
          lastName: customer.name?.split(" ").slice(1).join(" ") || "-",
          gender:
            genderMap[customer.gender as keyof typeof genderMap] ?? "Other",
          mobileNumber: customer.phone,
        },
      ],
    );

   console.log("subscribe res", subscribeRes);

    if (!subscribeRes.success) {
      consultation.status = ConsultationStatus.FAILED;
      consultation.failureReason = "Zaynax subscribe call failed";
      await consultation.save();

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Doctor service unavailable, please try again shortly",
      );
    }

    const patientToken = (
      await ZaynaxApi.getUserToken(
        ZaynaxApi.extractTokenFromUrl(subscribeRes.data.URL),
      )
    ).data.token;

    // Stored so we can re-fetch booking details (prescription) after the
    // call ends, and also so the frontend can proactively reconnect a
    // socket to listen for a doctor callback (see
    // getActiveConsultationForSocket below), without re-authenticating.
    consultation.zaynaxToken = patientToken;

    // Shared corporate pool balance safety check.
    const hasPoolBalance = await ZaynaxApi.checkPackageForCall(patientToken);

    if (!hasPoolBalance) {
      consultation.status = ConsultationStatus.POOL_EXHAUSTED;
      consultation.failureReason = "Zaynax corporate package balance is empty";
      await consultation.save();

      throw new AppError(
        httpStatus.SERVICE_UNAVAILABLE,
        "Doctor consultation service is temporarily unavailable",
      );
    }

    consultation.status = ConsultationStatus.ELIGIBLE;
    await consultation.save();

    // Book the appointment.
    const booking = await ZaynaxApi.bookQuickAppointment(
      patientToken,
      customer.name,
      clientSideAppointmentId,
    );

    consultation.zaynaxBookingId = booking.id;
    consultation.zaynaxOrderType = booking.orderType; // captured from booking response, not hardcoded
    consultation.status = ConsultationStatus.BOOKED;
    await consultation.save();

    // Pay from the shared package balance — this is the point of truth for
    // usage count, since Zaynax's own pool balance is deducted here
    // regardless of whether the doctor later accepts or rejects the call.
    const paid = await ZaynaxApi.payByPackage(
      patientToken,
      booking.id,
      booking.orderType,
    );

    if (!paid) {
      consultation.status = ConsultationStatus.FAILED;
      consultation.failureReason = "Zaynax payment/by-package returned false";
      await consultation.save();
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Could not start consultation, please retry",
      );
    }

    consultation.status = ConsultationStatus.PAID;
    await consultation.save();

    // Get booking/doctor details — Zaynax assigns doctors asynchronously via
    // a queue, so poll until doctorID/doctorInfo show up (or time out).
    const details = await waitForDoctorAssignment(
      patientToken,
      booking.id,
      20,
      5000,
    );

    consultation.doctorId = details.doctorID;
    consultation.doctorName = `${details.doctorInfo.firstName.en} ${details.doctorInfo.lastName.en}`;
    consultation.roomId = `${booking.id}${details.patientID}`;
    await consultation.save();

    return {
      consultationId: consultation._id,
      roomId: consultation.roomId,
      orderID: booking.id,
      doctorInfo: details.doctorInfo,
      zaynaxAuthToken: patientToken, // frontend uses this to open the socket connection directly
    };
  } catch (error) {
    if (consultation.status === ConsultationStatus.INITIATED) {
      consultation.status = ConsultationStatus.FAILED;
      consultation.failureReason =
        error instanceof Error ? error.message : "Unknown error";
      await consultation.save();
    }

    throw error;
  }
};

interface IUpdateConsultationStatusPayload {
  status: ConsultationStatus;
  callStartedAt?: string;
  callEndedAt?: string;
  prescriptionUrl?: string;
}

/**
 * Frontend calls this as the socket lifecycle progresses
 * (RINGING / ACCEPTED / REJECTED / TIMEOUT / COMPLETED / CANCELLED),
 * optionally carrying callStartedAt (on ACCEPTED) / callEndedAt (on
 * COMPLETED) / prescriptionUrl (if the caller already has it).
 * Doesn't affect any counter — usage is already counted at PAID.
 */

/**
 * Called when the customer's dashboard/consultation page loads. Lets the
 * frontend proactively reconnect a socket (without emitting
 * PATIENT_OUTGOING_CALL) so it can catch a doctor callback that arrives
 * after the patient closed/refreshed the page from a previous attempt.
 * Returns null if there's nothing to listen for.
 */
const getActiveConsultationForSocket = async (userId: string) => {
  const consultation = await Consultation.findOne({
    customer: userId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select("+zaynaxToken");

  if (!consultation || !consultation.zaynaxToken || !consultation.roomId) {
    return null;
  }

  return {
    consultationId: consultation._id,
    roomId: consultation.roomId,
    orderID: consultation.zaynaxBookingId,
    zaynaxAuthToken: consultation.zaynaxToken,
  };
};

const getMyConsultations = async ({
  query,
  userId,
}: {
  query: Record<string, string>;
  userId: string;
}) => {
  const baseQuery = Consultation.find({ customer: userId, isDeleted: false });

  const queryBuilder = new QueryBuilder(baseQuery, query);

  const data = await queryBuilder
    .filter()
    .search(consultationSearchableFields)
    .sort()
    .fields()
    .paginate()
    .build()
    .populate("subscription", "package status");

  const meta = await queryBuilder.getMeta();

  return { data, meta };
};

/** Simple usage count — no limit is enforced against this yet, it's tracked for future use. */
const getMyConsultationCount = async (userId: string) => {
  const count = await Consultation.countDocuments({
    customer: userId,
    isDeleted: false,
    status: {
      $in: [
        ConsultationStatus.PAID,
        ConsultationStatus.RINGING,
        ConsultationStatus.ACCEPTED,
        ConsultationStatus.COMPLETED,
      ],
    },
  });

  return { count };
};

const getSingleConsultation = async (id: string) => {
  const consultation = await Consultation.findById(id).populate(
    "subscription",
    "package status",
  );

  if (!consultation) {
    throw new AppError(httpStatus.NOT_FOUND, "Consultation not found");
  }

  return consultation;
};

export const ConsultationServices = {
  initiateConsultation,
  updateConsultationStatus,
  fetchPrescription,
  reconcileStaleConsultations,
  getActiveConsultationForSocket,
  getMyConsultations,
  getMyConsultationCount,
  getSingleConsultation,
};
