export interface ISurjoPay {
  amount: number;

  orderId: string;

  customerName: string;

  customerEmail?: string;

  customerPhone: string;

  customerAddress: string;

  customerCity: string;

  customerState?: string;

  customerPostcode?: string;

  customerCountry?: string;

  customerZip?: string;

  clientIp?: string;
  value1?: string;
  value2?: string;
  value3?: string;
  value4?: string;
}