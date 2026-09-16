
/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import AppError from "../errorHelpers/appError";

export interface IInvoiceData {
  orderId: string;
  customOrderId?: number;
  orderDate: Date;
  orderType: string;
  orderStatus: string;

  paymentMethod: string;
  paymentStatus: string;
  transactionId: string;
  amount: number;
  currency: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;

  products: {
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
}

export const generatePdf = async (
  data: IInvoiceData
): Promise<Buffer> => {
  try {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      const buffers: Uint8Array[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // ================= HEADER =================

      doc
        .font("Helvetica-Bold")
        .fontSize(28)
        .fillColor("#1F2937")
        .text("INVOICE", { align: "center" });

      doc.moveDown();

      // ================= ORDER INFO =================

      doc.font("Helvetica-Bold").fontSize(14).text("Order Information");
      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(12)
        .text(`Order ID: #${data.customOrderId ?? data.orderId}`)
        .text(`Order Date: ${data.orderDate.toDateString()}`)
        .text(`Order Type: ${data.orderType}`)
        .text(`Order Status: ${data.orderStatus}`);

      doc.moveDown();

      // ================= PAYMENT INFO =================

      doc.font("Helvetica-Bold").fontSize(14).text("Payment Information");
      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(12)
        .text(`Payment Method: ${data.paymentMethod}`)
        .text(`Payment Status: ${data.paymentStatus}`)
        .text(`Transaction ID: ${data.transactionId}`)
        .text(`Total Amount: ${data.currency} ${data.amount.toFixed(2)}`);

      doc.moveDown();

      // ================= CUSTOMER INFO =================

      doc.font("Helvetica-Bold").fontSize(14).text("Customer Information");
      doc.moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(12)
        .text(`Name: ${data.customerName}`)
        .text(`Email: ${data.customerEmail}`)
        .text(`Phone: ${data.customerPhone}`)
        .text(`Address: ${data.customerAddress}`);

      doc.moveDown();

      // ================= PRODUCTS TABLE =================

      doc.font("Helvetica-Bold").fontSize(14).text("Order Items");
      doc.moveDown(0.5);

      const itemX = 50;
      const qtyX = 300;
      const priceX = 360;
      const subtotalX = 450;

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Item", itemX)
        .text("Qty", qtyX)
        .text("Price", priceX)
        .text("Subtotal", subtotalX);

      doc.moveDown(0.3);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      doc.moveDown(0.5);

      data.products.forEach((item) => {
        const y = doc.y;

        doc
          .font("Helvetica")
          .fontSize(12)
          .text(item.name, itemX, y, { width: 240 })
          .text(item.quantity.toString(), qtyX, y)
          .text(`${data.currency} ${item.price.toFixed(2)}`, priceX, y)
          .text(`${data.currency} ${item.subtotal.toFixed(2)}`, subtotalX, y);

        doc.moveDown();
      });

      // ================= TOTAL =================

      doc.moveDown();

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(
          `Grand Total: ${data.currency} ${data.amount.toFixed(2)}`,
          { align: "right" }
        );

      doc.moveDown(2);

      doc
        .font("Helvetica")
        .fontSize(12)
        .text("Thank you for your order!", { align: "center" });

      doc.end();
    });
  } catch (error: any) {
    throw new AppError(500, `Pdf creation error ${error.message}`);
  }
};