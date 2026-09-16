
import axios from "axios";
import { AxiosError } from "axios";
import { zaynaxConfig } from "../../config/zaynax.config";
import { ZaynaxCrypto } from "../../utils/zaynaxCrypto";

interface ZaynaxUser {
  firstName: string;
  lastName: string;
  gender: "Male" | "Female" | "Other";
  mobileNumber: string;
}

interface SubscribeResponse {
  success: boolean;
  data: {
    isAlreadyActivated: boolean;
    message: string;
    URL: string;
    subscriptionInfo: {
      firstName: string;
      lastName: string;
      mobileNumber: string;
      subscriptionTime: string;
    };
  };
  message: string | null;
}

interface UserTokenResponse {
  success: boolean;
  data: {
    clientId: string;
    clientSideAppointmentId: string;
    users: ZaynaxUser[];
    token: string; // "Bearer xxx"
  };
  message: string | null;
}

// NOTE: shape of each prescription entry hasn't been confirmed by Zaynax yet —
// this is deliberately loose (Record<string, any>) so extractPrescriptionUrl
// can probe a few likely field names without a hard type mismatch. Once
// Zaynax confirms the exact shape, tighten this up.
type ZaynaxPrescription = Record<string, any>;

interface BookingDetails {
  id: string;
  doctorID: string;
  patientID: string;
  doctorInfo: {
    firstName: { en: string; bn: string };
    lastName: { en: string; bn: string };
    image: string;
  };
  prescriptions?: ZaynaxPrescription[];
}


// zaynax-api.service.ts 


const extractZaynaxError = (err: unknown): string => {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: unknown } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (typeof data?.message === "string") return data.message;
    return `Zaynax ${err.response?.status ?? ""}: ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unknown Zaynax error";
};

/**
 * Pulls a usable URL out of a Zaynax prescription entry. The exact field
 * name Zaynax uses hasn't been confirmed, so this checks the common
 * candidates in order and returns the first hit.
 */
// const extractPrescriptionUrl = (
//   prescriptions?: ZaynaxPrescription[],
// ): string | undefined => {
//   if (!prescriptions || prescriptions.length === 0) return undefined;

//   const entry = prescriptions[0];
//   return (
//     entry.prescriptionUrl ??
//     entry.url ??
//     entry.pdfUrl ??
//     entry.fileUrl ??
//     entry.link ??
//     undefined
//   );
// };

const extractPrescriptionUrl = (
  prescriptions?: ZaynaxPrescription[],
): string | undefined => {
  if (!prescriptions || prescriptions.length === 0) return undefined;

  const entry = prescriptions[0];
  return (
    entry.prescriptionURL ??  // <-- actual field Zaynax returns
    entry.prescriptionUrl ??
    entry.url ??
    entry.pdfUrl ??
    entry.fileUrl ??
    entry.link ??
    undefined
  );
};

const http = axios.create({ baseURL: zaynaxConfig.baseUrl });
console.log("Base url in top", zaynaxConfig.baseUrl)
const authHeader = (token: string) => ({ Authorization: token });

/**
 * Step 1-2: activate/refresh this patient's record under the shared corporate account+package.
 * Safe to call every time — Zaynax reports isAlreadyActivated if it's already active.
 */
const subscribeCorporatePackage = async (
  clientSideAppointmentId: string,
  logo: string,
  users: ZaynaxUser[],
): Promise<SubscribeResponse> => {
  const encryptedData = ZaynaxCrypto.encrypt({
    clientId: zaynaxConfig.clientId,
    clientSideAppointmentId,
    logo,
    users,
  });

  try {

    const { data } = await http.post<SubscribeResponse>(
      "/corporate_activator_service/corporate-panel/subscribe/api/chhaya",
      { clientId: zaynaxConfig.clientId, encryptedData },
    );

    return data;

  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

/** Exchanges the encryptedData token from the subscribe URL for a usable Bearer token. */
const getUserToken = async (encryptedData: string): Promise<UserTokenResponse> => {
  try {
    const { data } = await http.post<UserTokenResponse>(
      "/corporate_activator_service/corporate-panel/decrypt-data-extract-user-token",
      { clientId: zaynaxConfig.clientId, encryptedData },
    );

    console.log("user token...", data)

    return data;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

/** Step 4: does the shared corporate pool have package balance left at all? */
const checkPackageForCall = async (token: string): Promise<boolean> => {
  try {
    const { data } = await http.get<{ data: boolean; message: string }>(
      "/order_service/user-balance/check-package-for-call",
      { headers: authHeader(token) },
    );

    return data.data;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

/** Step 5: create the quick appointment booking. */
const bookQuickAppointment = async (
  token: string,
  appointmentFor: string,
  clientSideAppointmentId: string,
): Promise<{ id: string; corporateClientId: string; clientSideAppointmentId?: string; orderType: string }> => {
  try {
    const { data } = await http.post(
      "/order_service/booking/quick-appointment/instant",
      { appointmentFor, clientSideAppointmentId },
      { headers: authHeader(token) },
    );

    return data.data;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

/** Step 6: deduct the consultation fee from the shared package balance. */
const payByPackage = async (token: string, orderID: string, orderType: string): Promise<boolean> => {
  try {
    const { data } = await http.post<{ data: boolean; message: string }>(
      "/payment_service/payment/by-package",
      { orderID, orderType },
      { headers: authHeader(token) },
    );
    return data.data;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

/** Step 7: fetch booking + doctor + prescription details, needed to build the room ID. */
const getBookingDetails = async (
  token: string,
  bookingId: string,
): Promise<BookingDetails> => {
  try {
    console.log("baseURL:", zaynaxConfig.baseUrl);

    const { data } = await axios.get(
      `${zaynaxConfig.baseUrl}/order_service/booking/${bookingId}`,
      {
        headers: authHeader(token),
      }
    );

    console.log("booking details res ", data);

    return data.data;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};



/** Pulls the `token` query param out of the URL Zaynax returns from the subscribe call. */
const extractTokenFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (!token) throw new Error("Zaynax subscribe response URL had no token param");
    return token;
  } catch (err) {
    throw new Error(extractZaynaxError(err));
  }
};

export const ZaynaxApi = {
  subscribeCorporatePackage,
  getUserToken,
  checkPackageForCall,
  bookQuickAppointment,
  payByPackage,
  getBookingDetails,
  extractTokenFromUrl,
  extractPrescriptionUrl,
};