import Razorpay from "razorpay";
import { appConfig } from "./runtimeConfig.js";

let razorpayClient = null;

export const getRazorpayClient = () => {
  if (razorpayClient) return razorpayClient;
  if (!appConfig.payments.razorpay.keyId || !appConfig.payments.razorpay.keySecret) {
    throw new Error("Missing Razorpay credentials");
  }
  razorpayClient = new Razorpay({
    key_id: appConfig.payments.razorpay.keyId,
    key_secret: appConfig.payments.razorpay.keySecret,
  });
  return razorpayClient;
};

const razorpay = new Proxy(
  {},
  {
    get(_target, property) {
      return getRazorpayClient()[property];
    },
  }
);

export default razorpay;
