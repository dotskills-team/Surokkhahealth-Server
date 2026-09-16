import axios from "axios";
import httpStatus from "http-status-codes";

import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/appError";
import { PaymentModel } from "../payment/payment.model";
import { ISurjoPay } from "./surjoPay.interface";

const getToken = async () => {
  try {
    const response = await axios({
      method: "POST",
      url: `${envVars.SURJOPAY.SP_BASE_URL}/get_token`,
      data: {
        username: envVars.SURJOPAY.SP_USERNAME,
        password: envVars.SURJOPAY.SP_PASSWORD,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    console.log("SurjoPay token error");

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.message || error.message
    );
  }
};

const paymentInit = async (payload: ISurjoPay) => {
  try {
    const tokenData = await getToken();

    const data = {
      prefix: envVars.SURJOPAY.SP_PREFIX,
      token: tokenData.token,
      store_id: tokenData.store_id,

      return_url: envVars.SURJOPAY.SP_RETURN_URL,
      cancel_url: envVars.SURJOPAY.SP_CANCEL_URL,

      amount: payload.amount,
      order_id: payload.orderId,
      currency: envVars.SURJOPAY.SP_CURRENCY,

      customer_name: payload.customerName,
      customer_address: payload.customerAddress,
      customer_email: payload.customerEmail || "",
      customer_phone: payload.customerPhone,
      customer_city: payload.customerCity,

      customer_state: payload.customerState || "",
      customer_postcode: payload.customerPostcode || "",
      customer_country: payload.customerCountry || "BD",

      client_ip: payload.clientIp || "127.0.0.1",

      value1: payload.value1 || "",
      value2: payload.value2 || "",
      value3: payload.value3 || "",
      value4: payload.value4 || "",
    };

    const response = await axios({
      method: "POST",
      url: `${envVars.SURJOPAY.SP_BASE_URL}/secret-pay`,
      data,
      headers: {
        Authorization: `${tokenData.token_type} ${tokenData.token}`,
        "Content-Type": "application/json",
      },
    });

    await PaymentModel.updateOne(
      { transactionId: payload.orderId },
      {
        spOrderId: response.data.sp_order_id,
        paymentGatewayData: response.data,
      },
      { runValidators: true }
    );
    
    return {
      checkoutUrl: response.data.checkout_url,
      spOrderId: response.data.sp_order_id,
      customerOrderId: response.data.customer_order_id,
      transactionStatus: response.data.transactionStatus,
      paymentGatewayData: response.data,
    };
  } catch (error: any) {
    console.log("SurjoPay payment init error", error);

    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.message || error.message
    );
  }
};

const verifyPayment = async (spOrderId: string) => {
  try {
    const tokenData = await getToken();

    const response = await axios({
      method: "POST",
      url: `${envVars.SURJOPAY.SP_BASE_URL}/verification`,
      data: { order_id: spOrderId },
      headers: {
        Authorization: `${tokenData.token_type} ${tokenData.token}`,
        "Content-Type": "application/json",
      },
    });

    const paymentData = Array.isArray(response.data)
      ? response.data[0]
      : response.data;

    return paymentData;
    return paymentData;
  } catch (error: any) {
    console.log("SurjoPay verification error");
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.message || error.message
    );
  }
};

export const SurjoPayService = {
  getToken,
  paymentInit,
  verifyPayment,
};