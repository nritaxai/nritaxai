import { processConsultationNotifications } from "../workers/processors/consultation.processor.js";

export const sendConsultationNotificationsInline = async (payload) =>
  processConsultationNotifications(payload);
