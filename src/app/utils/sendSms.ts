// import { MessageType } from "../modules/message/message.interface";
// import { MessageService } from "../modules/message/message.service";

// export const sendSMS = async (
//   phone: string,
//   message: string,
//   type: MessageType
// ) => {

//   await MessageService.createMessage({
//     phone,
//     message,
//     type
//   });

//   console.log("\n========== SMS ==========");
//   console.log("Phone:", phone);
//   console.log("Message:", message);
//   console.log("=========================\n");

//   return true;
// };





import axios from "axios";
import { MessageType } from "../modules/message/message.interface";
import { MessageService } from "../modules/message/message.service";
import { envVars } from "../config/env";

export const sendSMS = async (
  phone: string,
  message: string,
  type: MessageType
): Promise<boolean> => {
  try {
    // Save message to database
    await MessageService.createMessage({
      phone,
      message,
      type,
    });

    // Send SMS via BulkSMSBD
    const { data } = await axios.get("http://bulksmsbd.net/api/smsapi", {
      params: {
        api_key: envVars.SMS_API_KEY,
        type: "text",
        number: phone,
        senderid: envVars.SMS_SENDER_ID,
        message,
      },
    });

    console.log("\n========== SMS ==========");
    console.log("Phone:", phone);
    console.log("Message:", message);
    console.log("Response:", data);
    console.log("=========================\n");

    return true;
  } catch (error: any) {
    console.error("SMS Send Error:", error.response?.data || error.message);
    return false;
  }
};