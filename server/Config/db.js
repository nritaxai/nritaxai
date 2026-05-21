import dns from "node:dns/promises";
import mongoose from "mongoose";

dns.setServers(["1.1.1.1", "8.8.8.8"]);
console.log("DNS servers forced to:", dns.getServers());

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
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
      console.log("MongoDB connected successfully");
      return connection.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      console.error("MongoDB connection failed", error.message);
      throw error;
    });

  return connectionPromise;
};

export default connectDB;
