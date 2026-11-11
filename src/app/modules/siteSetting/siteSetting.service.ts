import httpStatus from "http-status-codes";
import AppError from "../../errorHelpers/appError";
import { Role } from "../user/user.interface";
import { SiteSetting } from "./siteSetting.model";

const SETTING_KEY = "site-setting";

// Roles that stay able to use the system while staff access is switched off.
const ALWAYS_ALLOWED_ROLES: string[] = [
  Role.CUSTOMER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

// Tiny in-memory cache so per-request checks (checkAuth) don't add a DB hit every time.
const CACHE_TTL_MS = 5000;
let cache: { value: boolean; expiresAt: number } | null = null;

const isStaffAccessEnabled = async (): Promise<boolean> => {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const setting = await SiteSetting.findOne({ key: SETTING_KEY }).lean();
  const value = setting?.staffAccessEnabled ?? true;

  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
};

// Throws if the site is switched off for this role.
const assertRoleAllowed = async (role?: string) => {
  if (role && ALWAYS_ALLOWED_ROLES.includes(role)) return;

  if (!(await isStaffAccessEnabled())) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "The system is temporarily unavailable for staff. Please try again later.",
    );
  }
};

const getSiteSetting = async () => {
  const setting = await SiteSetting.findOne({ key: SETTING_KEY })
    .populate("updatedBy", "name email role")
    .lean();

  return {
    staffAccessEnabled: setting?.staffAccessEnabled ?? true,
    updatedBy: setting?.updatedBy ?? null,
    updatedAt: (setting as any)?.updatedAt ?? null,
  };
};

const updateSiteSetting = async (
  staffAccessEnabled: boolean,
  updatedBy?: string,
) => {
  if (typeof staffAccessEnabled !== "boolean") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "staffAccessEnabled must be a boolean",
    );
  }

  const setting = await SiteSetting.findOneAndUpdate(
    { key: SETTING_KEY },
    { $set: { staffAccessEnabled, ...(updatedBy && { updatedBy }) } },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  cache = null;

  return setting;
};

export const SiteSettingService = {
  isStaffAccessEnabled,
  assertRoleAllowed,
  getSiteSetting,
  updateSiteSetting,
};
