import dns from "node:dns/promises";
import mongoose from "mongoose";
import { logger } from "../services/logger.js";
import { recordDbOperationMetric, setDbConnectionStateMetric } from "../services/metrics.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
console.log("DNS servers forced to:", dns.getServers());

let connectionPromise = null;
let mongooseInstrumentationEnabled = false;
const FALLBACK_DB_NAME = "nritax";
const DISALLOWED_DB_NAMES = new Set(["sample_mflix", "admin", "local", "test"]);

export const maskMongoUri = (uri = "") => {
  const raw = String(uri || "").trim();
  if (!raw) return "";
  return raw.replace(
    /(mongodb(?:\+srv)?:\/\/)([^:/?#@]+)(?::([^@/?#]*))?@/i,
    (_match, prefix, username, password) => `${prefix}${username}${password !== undefined ? ":***" : ""}@`
  );
};

export const resolveMongoConnectionConfig = (env = process.env) => {
  const uri = String(env.MONGO_URI || "").trim();
  const normalizedDbName = String(env.MONGO_DB_NAME || "").trim();
  const withoutScheme = uri.replace(/^mongodb(?:\+srv)?:\/\//i, "");
  const withoutCredentials = withoutScheme.includes("@") ? withoutScheme.split("@").slice(-1)[0] : withoutScheme;
  const [authorityAndPath = ""] = withoutCredentials.split("?");
  const slashIndex = authorityAndPath.indexOf("/");
  const host = slashIndex >= 0 ? authorityAndPath.slice(0, slashIndex) : authorityAndPath;
  const dbPath = slashIndex >= 0 ? authorityAndPath.slice(slashIndex + 1) : "";
  const explicitDbName = dbPath ? decodeURIComponent(String(dbPath).split("/")[0] || "").trim() : "";
  const dbName = explicitDbName || normalizedDbName || FALLBACK_DB_NAME;
  const dbNameSource = explicitDbName ? "uri" : normalizedDbName ? "env" : "default";

  return {
    uri,
    maskedUri: maskMongoUri(uri),
    host: host || "unknown",
    dbName,
    dbNameSource,
    hasExplicitDbName: Boolean(explicitDbName || normalizedDbName),
  };
};

const assertAllowedDatabaseName = ({ dbName = "", maskedUri = "" } = {}) => {
  const normalized = String(dbName || "").trim().toLowerCase();
  if (!DISALLOWED_DB_NAMES.has(normalized)) return;
  throw new Error(`Refusing MongoDB connection to database "${dbName}" from ${maskedUri || "unknown URI"}`);
};

const instrumentMongoose = () => {
  if (mongooseInstrumentationEnabled) return;
  mongooseInstrumentationEnabled = true;

  const originalQueryExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function patchedQueryExec(...args) {
    const startedAt = Date.now();
    try {
      const result = await originalQueryExec.apply(this, args);
      recordDbOperationMetric({
        operation: this.op || "query",
        collection: this.model?.collection?.collectionName || this.mongooseCollection?.name || "unknown",
        durationMs: Date.now() - startedAt,
        failed: false,
      });
      return result;
    } catch (error) {
      recordDbOperationMetric({
        operation: this.op || "query",
        collection: this.model?.collection?.collectionName || this.mongooseCollection?.name || "unknown",
        durationMs: Date.now() - startedAt,
        failed: true,
      });
      throw error;
    }
  };

  const originalAggregateExec = mongoose.Aggregate.prototype.exec;
  mongoose.Aggregate.prototype.exec = async function patchedAggregateExec(...args) {
    const startedAt = Date.now();
    try {
      const result = await originalAggregateExec.apply(this, args);
      recordDbOperationMetric({
        operation: "aggregate",
        collection: this._model?.collection?.collectionName || "unknown",
        durationMs: Date.now() - startedAt,
        failed: false,
      });
      return result;
    } catch (error) {
      recordDbOperationMetric({
        operation: "aggregate",
        collection: this._model?.collection?.collectionName || "unknown",
        durationMs: Date.now() - startedAt,
        failed: true,
      });
      throw error;
    }
  };

  const originalSave = mongoose.Model.prototype.save;
  mongoose.Model.prototype.save = async function patchedSave(...args) {
    const startedAt = Date.now();
    try {
      const result = await originalSave.apply(this, args);
      recordDbOperationMetric({
        operation: "save",
        collection: this.collection?.collectionName || this.constructor?.collection?.collectionName || "unknown",
        durationMs: Date.now() - startedAt,
        failed: false,
      });
      return result;
    } catch (error) {
      recordDbOperationMetric({
        operation: "save",
        collection: this.collection?.collectionName || this.constructor?.collection?.collectionName || "unknown",
        durationMs: Date.now() - startedAt,
        failed: true,
      });
      throw error;
    }
  };
};

const setConnectionState = () => {
  setDbConnectionStateMetric(mongoose.connection.readyState);
};

instrumentMongoose();
setConnectionState();
mongoose.connection.on("connected", setConnectionState);
mongoose.connection.on("disconnected", setConnectionState);
mongoose.connection.on("connecting", setConnectionState);
mongoose.connection.on("disconnecting", setConnectionState);
mongoose.connection.on("error", setConnectionState);

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    setConnectionState();
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoConfig = resolveMongoConnectionConfig();
  assertAllowedDatabaseName(mongoConfig);

  if (!mongoConfig.hasExplicitDbName) {
    logger.warn(
      {
        dbName: mongoConfig.dbName,
        dbNameSource: mongoConfig.dbNameSource,
        maskedUri: mongoConfig.maskedUri,
      },
      "MongoDB URI does not specify a database name; using resolved fallback"
    );
  }

  connectionPromise = mongoose
    .connect(mongoConfig.uri, {
      dbName: mongoConfig.dbName,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
      maxIdleTimeMS: Number(process.env.MONGO_MAX_IDLE_TIME_MS || 30000),
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 20000),
      heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_FREQUENCY_MS || 10000),
      retryWrites: String(process.env.MONGO_RETRY_WRITES || "true").toLowerCase() !== "false",
      readPreference: String(process.env.MONGO_READ_PREFERENCE || "primaryPreferred").trim(),
    })
    .then((connection) => {
      setConnectionState();
      console.log("Connected DB:", connection.connection.name);
      console.log("Mongo Host:", connection.connection.host);
      logger.info(
        {
          dbName: connection.connection.name,
          dbNameSource: mongoConfig.dbNameSource,
          mongoHost: connection.connection.host,
          maskedUri: mongoConfig.maskedUri,
          maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
          minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
          readPreference: String(process.env.MONGO_READ_PREFERENCE || "primaryPreferred").trim(),
        },
        "MongoDB connected successfully"
      );
      return connection.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      setConnectionState();
      logger.error(
        {
          error: error?.message || String(error),
          dbName: mongoConfig.dbName,
          mongoHost: mongoConfig.host,
          maskedUri: mongoConfig.maskedUri,
        },
        "MongoDB connection failed"
      );
      throw error;
    });

  return connectionPromise;
};

export const getDbReadiness = () => ({
  ready: mongoose.connection.readyState === 1,
  state: mongoose.connection.readyState,
});

export default connectDB;
