import { model, Schema } from "mongoose";
import { ISiteSetting } from "./siteSetting.interface";

const siteSettingSchema = new Schema<ISiteSetting>(
  {
    key: {
      type: String,
      default: "site-setting",
      unique: true,
      immutable: true,
    },
    // When false, staff roles (everyone except CUSTOMER, ADMIN, SUPER_ADMIN) cannot use the system.
    staffAccessEnabled: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export const SiteSetting = model<ISiteSetting>("SiteSetting", siteSettingSchema);
