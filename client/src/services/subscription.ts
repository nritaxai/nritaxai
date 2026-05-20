import { Capacitor } from "@capacitor/core";
import {
  CapacitorInAppPurchase,
  type PluginListenerHandle,
  type Product,
  type TransactionEvent,
} from "@adplorg/capacitor-in-app-purchase";
import { APPLE_SUBSCRIPTION_PRODUCT_ID } from "../config/appConfig";

const PRODUCT_ID = APPLE_SUBSCRIPTION_PRODUCT_ID;

export const getSubscriptionProductId = () => PRODUCT_ID;

let transactionListenerHandle: PluginListenerHandle | null = null;

const createReferenceUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `nritax-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const isNativePurchasePlatform = () => Capacitor.isNativePlatform();

export const initPurchases = async () => {
  if (!isNativePurchasePlatform() || transactionListenerHandle) {
    return transactionListenerHandle;
  }

  transactionListenerHandle = await CapacitorInAppPurchase.addListener(
    "transaction",
    async (data: TransactionEvent) => {
      console.log("Purchase update:", data);
    }
  );

  return transactionListenerHandle;
};

export const getProducts = async (): Promise<Product[]> => {
  if (!isNativePurchasePlatform()) return [];

  const { products } = await CapacitorInAppPurchase.getProducts({
    productIds: [PRODUCT_ID],
  });

  return products;
};

export const purchaseSubscription = async (offerToken?: string) => {
  const referenceUUID = createReferenceUUID();

  try {
    const result = await CapacitorInAppPurchase.purchaseSubscription({
      productId: PRODUCT_ID,
      referenceUUID,
      offerToken,
    });
    console.log("Purchase success:", result);
    return result;
  } catch (error) {
    console.log("Purchase failed:", error);
    throw error;
  }
};

export const restorePurchases = async () => {
  try {
    const result = await CapacitorInAppPurchase.getActiveSubscriptions();
    console.log("Restore success:", result);
    return result;
  } catch (error) {
    console.log("Restore failed:", error);
    throw error;
  }
};

export const manageSubscriptions = async () => {
  await CapacitorInAppPurchase.manageSubscriptions({});
};
