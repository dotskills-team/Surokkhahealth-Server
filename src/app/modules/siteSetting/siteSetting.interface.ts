import { Types } from "mongoose";

export interface ISiteSetting {
  key: string; // singleton key, always "site-setting"
  staffAccessEnabled: boolean;
  updatedBy?: Types.ObjectId;
}
