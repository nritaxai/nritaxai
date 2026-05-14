import dns from "node:dns/promises";
import mongoose from "mongoose";
import { logger } from "../services/logger.js";
import { recordDbOperationMetric, setDbConnectionStateMetric } from "../services/metrics.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
console.log("DNS servers forced to:", dns.getServers());

let connectionPromise = null;
let mongooseInstrumentationEnabled = false;

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

  connectionPromise = mongoose
    .connect(process.env.MONGO_URI, {
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
      logger.info(
        {
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
      logger.error({ error: error?.message || String(error) }, "MongoDB connection failed");
      throw error;
    });

  return connectionPromise;
};

export const getDbReadiness = () => ({
  ready: mongoose.connection.readyState === 1,
  state: mongoose.connection.readyState,
});

export default connectDB;
