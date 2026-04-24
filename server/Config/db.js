import dns from "node:dns/promises";
import mongoose from "mongoose";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

let connectionPromise = null;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(process.env.MONGO_URI)
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
