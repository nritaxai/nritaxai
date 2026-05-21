import crypto from "crypto";
import { featureFlags } from "../Config/featureFlags.js";

let pinoLogger = null;

const createFallbackLogger = () => {
  const write = (level, payload) => {
    const record = {
      level,
      time: new Date().toISOString(),
      ...payload,
    };
    const line = JSON.stringify(record);
    if (level === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  };

  return {
    info(payload, message) {
      write("info", typeof payload === "object" ? { ...payload, msg: message || payload?.msg } : { msg: message || payload });
    },
    warn(payload, message) {
      write("warn", typeof payload === "object" ? { ...payload, msg: message || payload?.msg } : { msg: message || payload });
    },
    error(payload, message) {
      write("error", typeof payload === "object" ? { ...payload, msg: message || payload?.msg } : { msg: message || payload });
    },
    child(bindings = {}) {
      return {
        info(payload, message) {
          write("info", { ...bindings, ...(typeof payload === "object" ? payload : {}), msg: message || payload?.msg || payload });
        },
        warn(payload, message) {
          write("warn", { ...bindings, ...(typeof payload === "object" ? payload : {}), msg: message || payload?.msg || payload });
        },
        error(payload, message) {
          write("error", { ...bindings, ...(typeof payload === "object" ? payload : {}), msg: message || payload?.msg || payload });
        },
      };
    },
  };
};

const getPinoLogger = async () => {
  if (!featureFlags.structuredLoggingEnabled) {
    return createFallbackLogger();
  }

  if (pinoLogger) return pinoLogger;

  try {
    const { default: pino } = await import("pino");
    pinoLogger = pino({
      level: String(process.env.LOG_LEVEL || "info").trim(),
      base: {
        service: process.env.APP_NAME || "nritax-server",
        env: process.env.NODE_ENV || "development",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
    return pinoLogger;
  } catch {
    pinoLogger = createFallbackLogger();
    return pinoLogger;
  }
};

export const logger = await getPinoLogger();

export const createRequestId = () =>
  `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}`;
