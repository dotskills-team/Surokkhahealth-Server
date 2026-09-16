import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  PORT: string;
  DB_URL: string;
  NODE_ENV: "production" | "development";
  BCRYPT_SALT_ROUND: string;
  SUPER_ADMIN_PASS: string;
  SUPER_ADMIN_PHONE: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES: string;
  JWT_REFRESH_SECRET: string;
  REDIS_HOST: string;
  REDIS_PORT: string;
  REDIS_USERNAME: string;
  REDIS_PASSWORD: string;

  SMS_API_URL: string;
  SMS_API_KEY: string;
  SMS_SENDER_ID: string;

  JWT_REFRESH_EXPIRES: string;
  CLOUDINARY: {
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
  };
  EMAIL_SENDER: {
    SMTP_USER: string;
    SMTP_PASS: string;
    SMTP_PORT: string;
    SMTP_HOST: string;
    SMTP_FROM: string;
  };
  COMPANY_EMAIL: string;
  FRONTEND_URL: string;
  SERVER_URL: string;
  SSL: {
    SSL_STORE_ID: string,
    SSL_STORE_PASS: string,
    SSL_PAYMENT_API: string,
    SSL_INVOICE_API: string,
    SSL_VALIDATION_API: string,
    SSL_SUCCESS_BACKEND_URL: string,
    SSL_REFUND_API: string,
    SSL_REFUND_QUERY_API: string,
    SSL_FAIL_BACKEND_URL: string,
    SSL_CANCEL_BACKEND_URL: string,
    SSL_SUCCESS_FRONTEND_URL: string,
    SSL_FAIL_FRONTEND_URL: string,
    SSL_CANCEL_FRONTEND_URL: string,
    SSL_IPN_URL: string
  },

  SURJOPAY: {
    SP_BASE_URL: string;
    SP_USERNAME: string;
    SP_PASSWORD: string;
    SP_PREFIX: string;
    SP_RETURN_URL: string;
    SP_CANCEL_URL: string;
    SP_CURRENCY: string;
  },
}

const loadEnvVariables = (): EnvConfig => {
  const requiredEnvVariables: string[] = [
    "PORT",
    "DB_URL",
    "NODE_ENV",
    "BCRYPT_SALT_ROUND",
    "SUPER_ADMIN_PHONE",
    "SUPER_ADMIN_PASS",
    "JWT_ACCESS_SECRET",
    "JWT_ACCESS_EXPIRES",
    "JWT_REFRESH_SECRET",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_USERNAME",
    "REDIS_PASSWORD",

    "SMS_API_URL",
    "SMS_API_KEY",
    "SMS_SENDER_ID",
    "JWT_REFRESH_EXPIRES",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "FRONTEND_URL",
    "SERVER_URL",
    "SSL_STORE_ID",
    "SSL_STORE_PASS",
    "SSL_PAYMENT_API",
    "SSL_INVOICE_API",
    "SSL_VALIDATION_API",
    "SSL_REFUND_API",
    "SSL_REFUND_QUERY_API",
    "SSL_SUCCESS_BACKEND_URL",
    "SSL_FAIL_BACKEND_URL",
    "SSL_CANCEL_BACKEND_URL",
    "SSL_SUCCESS_FRONTEND_URL",
    "SSL_FAIL_FRONTEND_URL",
    "SSL_CANCEL_FRONTEND_URL",

    "SP_BASE_URL",
    "SP_USERNAME",
    "SP_PASSWORD",
    "SP_PREFIX",
    "SP_RETURN_URL",
    "SP_CANCEL_URL",
    "SP_CURRENCY",

  ];

  requiredEnvVariables.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing require environment variable ${key}`);
    }
  });

  return {
    PORT: process.env.PORT as string,
    DB_URL: process.env.DB_URL as string,
    NODE_ENV: process.env.NODE_ENV as "development" | "production",
    SUPER_ADMIN_PHONE: process.env.SUPER_ADMIN_PHONE as string,
    SUPER_ADMIN_PASS: process.env.SUPER_ADMIN_PASS as string,
    BCRYPT_SALT_ROUND: process.env.BCRYPT_SALT_ROUND as string,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES as string,
    CLOUDINARY: {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
    },
    REDIS_HOST: process.env.REDIS_HOST as string,
    REDIS_PORT: process.env.REDIS_PORT as string,
    REDIS_USERNAME: process.env.REDIS_USERNAME as string,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD as string,

    SMS_API_URL: process.env.SMS_API_URL as string,
    SMS_API_KEY: process.env.SMS_API_KEY as string,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID as string,
    EMAIL_SENDER: {
      SMTP_USER: process.env.SMTP_USER as string,
      SMTP_PASS: process.env.SMTP_PASS as string,
      SMTP_PORT: process.env.SMTP_PORT as string,
      SMTP_HOST: process.env.SMTP_HOST as string,
      SMTP_FROM: process.env.SMTP_FROM as string,
    },
    COMPANY_EMAIL: process.env.COMPANY_EMAIL as string,
    FRONTEND_URL: process.env.FRONTEND_URL as string,
    SERVER_URL: process.env.SERVER_URL as string,
    SSL: {
      SSL_STORE_ID: process.env.SSL_STORE_ID as string,
      SSL_STORE_PASS: process.env.SSL_STORE_PASS as string,
      SSL_PAYMENT_API: process.env.SSL_PAYMENT_API as string,
      SSL_INVOICE_API: process.env.SSL_INVOICE_API as string,
      SSL_VALIDATION_API: process.env.SSL_VALIDATION_API as string,
      SSL_REFUND_API: process.env.SSL_REFUND_API as string,
      SSL_REFUND_QUERY_API: process.env.SSL_REFUND_QUERY_API as string,
      SSL_SUCCESS_BACKEND_URL: process.env.SSL_SUCCESS_BACKEND_URL as string,
      SSL_FAIL_BACKEND_URL: process.env.SSL_FAIL_BACKEND_URL as string,
      SSL_CANCEL_BACKEND_URL: process.env.SSL_CANCEL_BACKEND_URL as string,
      SSL_SUCCESS_FRONTEND_URL: process.env.SSL_SUCCESS_FRONTEND_URL as string,
      SSL_FAIL_FRONTEND_URL: process.env.SSL_FAIL_FRONTEND_URL as string,
      SSL_CANCEL_FRONTEND_URL: process.env.SSL_CANCEL_FRONTEND_URL as string,
      SSL_IPN_URL: process.env.SSL_IPN_URL as string
    },

    SURJOPAY: {
      SP_BASE_URL: process.env.SP_BASE_URL as string,
      SP_USERNAME: process.env.SP_USERNAME as string,
      SP_PASSWORD: process.env.SP_PASSWORD as string,
      SP_PREFIX: process.env.SP_PREFIX as string,
      SP_RETURN_URL: process.env.SP_RETURN_URL as string,
      SP_CANCEL_URL: process.env.SP_CANCEL_URL as string,
      SP_CURRENCY: process.env.SP_CURRENCY as string,
    },
  };
};

export const envVars = loadEnvVariables();
