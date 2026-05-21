const {
  DEPLOY_ENVIRONMENT = "",
  IMAGE_TAG = "",
  REQUIRE_APPROVAL = "",
  RUN_MIGRATIONS = "false",
  MIGRATION_SAFETY_ACK = "",
  HEALTHCHECK_URL = "",
  CANARY_STEP_TIMEOUT_SECONDS = "300",
} = process.env;

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const environment = String(DEPLOY_ENVIRONMENT || "").trim().toLowerCase();
const imageTag = String(IMAGE_TAG || "").trim();
const healthcheckUrl = String(HEALTHCHECK_URL || "").trim();
const runMigrations = String(RUN_MIGRATIONS || "false").trim().toLowerCase() === "true";
const requireApproval = String(REQUIRE_APPROVAL || "").trim().toLowerCase() === "true";

if (!environment) fail("DEPLOY_ENVIRONMENT is required.");
if (!["staging", "production"].includes(environment)) {
  fail(`Unsupported DEPLOY_ENVIRONMENT: ${environment}`);
}
if (!imageTag) fail("IMAGE_TAG is required.");
if (!healthcheckUrl) fail("HEALTHCHECK_URL is required.");

const timeoutSeconds = Number(CANARY_STEP_TIMEOUT_SECONDS || 300);
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 60) {
  fail("CANARY_STEP_TIMEOUT_SECONDS must be at least 60.");
}

if (environment === "production" && !requireApproval) {
  fail("Production deployments must set REQUIRE_APPROVAL=true.");
}

if (runMigrations && MIGRATION_SAFETY_ACK !== "approved-no-destructive-migrations") {
  fail("Migration safety ack missing. Set MIGRATION_SAFETY_ACK=approved-no-destructive-migrations.");
}

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      environment,
      imageTag,
      requireApproval,
      runMigrations,
      healthcheckUrl,
      timeoutSeconds,
    },
    null,
    2
  ) + "\n"
);
