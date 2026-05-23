import test from "node:test";
import assert from "node:assert/strict";

import { maskMongoUri, resolveMongoConnectionConfig } from "../Config/db.js";

test("maskMongoUri hides credentials while preserving the cluster host", () => {
  const masked = maskMongoUri("mongodb+srv://alice:super-secret@cluster0.mongodb.net/nritax?retryWrites=true");
  assert.equal(masked, "mongodb+srv://alice:***@cluster0.mongodb.net/nritax?retryWrites=true");
});

test("resolveMongoConnectionConfig falls back to the nritax database when the URI omits a db name", () => {
  const config = resolveMongoConnectionConfig({
    MONGO_URI: "mongodb+srv://alice:secret@cluster0.a9ybw66.mongodb.net/?appName=Cluster0",
  });

  assert.equal(config.host, "cluster0.a9ybw66.mongodb.net");
  assert.equal(config.dbName, "nritax");
  assert.equal(config.dbNameSource, "default");
  assert.equal(config.hasExplicitDbName, false);
});

test("resolveMongoConnectionConfig prefers an explicit MONGO_DB_NAME when present", () => {
  const config = resolveMongoConnectionConfig({
    MONGO_URI: "mongodb+srv://alice:secret@cluster0.a9ybw66.mongodb.net/?appName=Cluster0",
    MONGO_DB_NAME: "nritax-production",
  });

  assert.equal(config.dbName, "nritax-production");
  assert.equal(config.dbNameSource, "env");
  assert.equal(config.hasExplicitDbName, true);
});
