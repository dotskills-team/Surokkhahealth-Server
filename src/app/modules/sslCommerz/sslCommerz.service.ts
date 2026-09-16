import axios from "axios";
import { envVars } from "../../config/env";
import { ISSLCommerz } from "./sslCommerz.interface";
import AppError from "../../errorHelpers/appError";
import httpStatus from "http-status-codes"
import { PaymentModel } from "../payment/payment.model";

const sslPaymentInit = async (payload: ISSLCommerz) => {

try {
        const data = {
        store_id: envVars.SSL.SSL_STORE_ID,
        store_passwd: envVars.SSL.SSL_STORE_PASS,
        total_amount: payload.amount,
        currency: "BDT",
        tran_id: payload.transactionId,
        success_url: `${envVars.SSL.SSL_SUCCESS_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=success`,
        fail_url: `${envVars.SSL.SSL_FAIL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=fail`,
        cancel_url: `${envVars.SSL.SSL_CANCEL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=cancel`,
        ipn_url: envVars.SSL.SSL_IPN_URL,
        cus_name: payload.name,
        cus_email: payload?.email || "N/A",
        cus_add1: payload.address,
        cus_add2: "N/A",
        cus_city: payload.city,
        cus_state: "N/A",
        cus_postcode: "N/A",
        cus_country: "Bangladesh",
        cus_phone: payload.phone,
        cus_fax: "N/A",
        ship_name: "N/A",
        ship_add1: "N/A",
        ship_add2: "N/A",
        ship_city: "N/A",
        ship_state: "N/A",
        ship_postcode: "N/A",
        ship_country: "N/A"
    }

    const response = await axios({
        method: "POST",
        url: envVars.SSL.SSL_PAYMENT_API,
        data: data,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }

    })

    return response.data;
} catch (error: any) {
    console.log("Payment error occurred")
    throw new AppError(httpStatus.BAD_REQUEST, error.message)
}
}

const validatePayment = async (payload: any) => {
    try {
        const response = await axios({
            method: "GET",
            url: `${envVars.SSL.SSL_VALIDATION_API}?val_id=${payload.val_id}&store_id=${envVars.SSL.SSL_STORE_ID}&store_passwd=${envVars.SSL.SSL_STORE_PASS}`
        })

        await PaymentModel.updateOne(
            { transactionId: payload.tran_id },
            { paymentGatewayData: response.data },
            { runValidators: true })
    } catch (error: any) {
        console.log(error);
        throw new AppError(401, `Payment Validation Error, ${error.message}`)
    }
}

// =============================================================
// REFUND INITIATE
// =============================================================
const initiateRefund = async (payload: {
    bank_tran_id: string;
    refund_amount: number;
    refund_remarks?: string;
}) => {
    try {
        const response = await axios({
            method: "GET",
            url: envVars.SSL.SSL_REFUND_API,
            params: {
                bank_tran_id: payload.bank_tran_id,
                refund_amount: payload.refund_amount,
                refund_remarks: payload.refund_remarks || "Refund processed by admin",
                refund_e_gw: "",
                format: "json",
                store_id: envVars.SSL.SSL_STORE_ID,
                store_passwd: envVars.SSL.SSL_STORE_PASS,
            },
        });

        return response.data;
        // SSLCommerz returns e.g.
        // { status: "success" | "processing" | "failed", refund_ref_id, errorReason, ... }
    } catch (error: any) {
        console.log("Refund initiation error occurred");
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Refund Initiation Error, ${error.message}`
        );
    }
};

// =============================================================
// REFUND STATUS QUERY (SSLCommerz refunds can be async — "processing")
// =============================================================
const queryRefundStatus = async (refundRefId: string) => {
    try {
        const response = await axios({
            method: "GET",
            url: envVars.SSL.SSL_REFUND_QUERY_API,
            params: {
                refund_ref_id: refundRefId,
                store_id: envVars.SSL.SSL_STORE_ID,
                store_passwd: envVars.SSL.SSL_STORE_PASS,
                format: "json",
            },
        });

        return response.data;
    } catch (error: any) {
        console.log("Refund query error occurred");
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Refund Query Error, ${error.message}`
        );
    }
};

// const createInvoice = async (payload: ISSLCommerz) => {
//     try {
//         const data = {
//             store_id: envVars.SSL.SSL_STORE_ID,
//             store_passwd: envVars.SSL.SSL_STORE_PASS,
//             total_amount: payload.amount,
//             currency: "BDT",
//             tran_id: payload.transactionId,

//             success_url: `${envVars.SSL.SSL_SUCCESS_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=success`,
//             fail_url: `${envVars.SSL.SSL_FAIL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=fail`,
//             cancel_url: `${envVars.SSL.SSL_CANCEL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=cancel`,
//             ipn_url: envVars.SSL.SSL_IPN_URL,

//             cus_name: payload.name,
//             cus_email: payload.email || "N/A",
//             cus_add1: payload.address,
//             cus_add2: "N/A",
//             cus_city: payload.city,
//             cus_state: "N/A",
//             cus_postcode: "N/A",
//             cus_country: "Bangladesh",
//             cus_phone: payload.phone,
//             cus_fax: "N/A",

//             ship_name: "N/A",
//             ship_add1: "N/A",
//             ship_add2: "N/A",
//             ship_city: "N/A",
//             ship_state: "N/A",
//             ship_postcode: "N/A",
//             ship_country: "N/A",
//         };

//         const response = await axios({
//             method: "POST",
//             url: envVars.SSL.SSL_INVOICE_API,
//             data,
//             headers: {
//                 "Content-Type": "application/x-www-form-urlencoded",
//             },
//         });

//         return {
//             success: true,
//             invoiceData: response.data,
//             paymentUrl:
//                 response.data.pay_url ||
//                 response.data.GatewayPageURL,
//             invoiceNo: response.data.invoice_no || null,
//             qrImage: response.data.qr_image || null,
//         };
//     } catch (error: any) {
//         console.log("Invoice creation error occurred");

//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             error.message
//         );
//     }
// };


const createInvoice = async (payload: ISSLCommerz) => {
    try {
        const data = {
            store_id: envVars.SSL.SSL_STORE_ID,
            store_passwd: envVars.SSL.SSL_STORE_PASS,

            refer: payload.transactionId,
            acct_no: payload.transactionId,

            total_amount: payload.amount,
            currency: "BDT",
            tran_id: payload.transactionId,

            success_url: `${envVars.SSL.SSL_SUCCESS_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=success`,
            fail_url: `${envVars.SSL.SSL_FAIL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=fail`,
            cancel_url: `${envVars.SSL.SSL_CANCEL_BACKEND_URL}?transactionId=${payload.transactionId}&amount=${payload.amount}&status=cancel`,
            ipn_url: envVars.SSL.SSL_IPN_URL,

            cus_name: payload.name,
            cus_email: payload.email || "N/A",
            cus_add1: payload.address,
            cus_add2: "N/A",
            cus_city: payload.city,
            cus_state: "N/A",
            cus_postcode: "N/A",
            cus_country: "Bangladesh",
            cus_phone: payload.phone,
            cus_fax: "N/A",

            ship_name: payload.name,
            ship_add1: payload.address,
            ship_add2: "N/A",
            ship_city: payload.city,
            ship_state: "N/A",
            ship_postcode: "N/A",
            ship_country: "Bangladesh",

            shipping_method: "NO",
            num_of_item: 1,
            product_name: "Insurance Subscription",
            product_category: "Insurance",
            product_profile: "non-physical-goods",

            value_a: "",
            value_b: "",
            value_c: "",
            value_d: "",
        };

        const response = await axios({
            method: "POST",
            url: envVars.SSL.SSL_INVOICE_API,
            data,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        return response.data;
    } catch (error: any) {
        console.log("Invoice creation error occurred");

        throw new AppError(
            httpStatus.BAD_REQUEST,
            error.response?.data?.failedreason || error.message
        );
    }
};

export const SSLCommerzService = {
    sslPaymentInit,
    createInvoice,
    validatePayment,
    initiateRefund,
    queryRefundStatus,
};

