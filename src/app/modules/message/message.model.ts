import { Schema, model } from "mongoose";
import { IMessage, MessageType } from "./message.interface";

const messageSchema = new Schema<IMessage>(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: Object.values(MessageType),
      default: MessageType.GENERAL,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Message = model<IMessage>("Message", messageSchema);