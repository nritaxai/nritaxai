import { featureFlags } from "../Config/featureFlags.js";
import { logger } from "./logger.js";

let otelSdk = null;

export const initObservability = async () => {
  if (!featureFlags.tracingEnabled) {
    return null;
  }

  try {
    const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }, { resourceFromAttributes }] =
      await Promise.all([
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/auto-instrumentations-node"),
        import("@opentelemetry/exporter-trace-otlp-http"),
        import("@opentelemetry/resources"),
      ]);

    otelSdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: String(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "").trim() || undefined,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
      resource: resourceFromAttributes({
        "service.name": process.env.APP_NAME || "nritax-server",
        "service.version": process.env.APP_VERSION || "dev",
        "deployment.environment": process.env.NODE_ENV || "development",
      }),
    });

    await otelSdk.start();
    logger.info({ enabled: true }, "opentelemetry initialized");
    return otelSdk;
  } catch (error) {
    logger.warn({ error: error?.message || String(error) }, "opentelemetry initialization skipped");
    return null;
  }
};

export const shutdownObservability = async () => {
  if (!otelSdk) return;
  try {
    await otelSdk.shutdown();
  } catch {
  }
};
