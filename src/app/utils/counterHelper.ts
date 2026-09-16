// src/utils/generateCustomId.ts

import { Counter } from "../modules/counter/counter.model";

export const generateCustomId = async (
  key: string,
  prefix: string,
  padLength = 6,
): Promise<string> => {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );

  const seqStr = String(counter.seq).padStart(padLength, "0");
  return `${prefix}-${seqStr}`;
};