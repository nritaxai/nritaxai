import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../Config/db.js";
import PromoCode from "../Models/promoCodeModel.js";

dotenv.config();

const usage = () => {
  console.log("Usage:");
  console.log('  node scripts/promoCodes.js generate --count=25 --prefix=NRI1M --batch=\"Apr-2026\" --createdBy=\"ops\"');
  console.log("  node scripts/promoCodes.js list --status=active --limit=100");
};

const parseArgs = (argv) => {
  const options = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rawValue] = arg.slice(2).split("=");
    options[rawKey] = rawValue.length > 0 ? rawValue.join("=") : "true";
  }
  return options;
};

const generateCode = (prefix) => {
  const entropy = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${entropy}`;
};

const ensurePrefix = (value) => String(value || "NRI1M").toUpperCase().replace(/[^A-Z0-9]/g, "");

const runGenerate = async (options) => {
  const count = Math.max(1, Number.parseInt(String(options.count || "10"), 10) || 10);
  const prefix = ensurePrefix(options.prefix);
  const batchLabel = String(options.batch || new Date().toISOString().slice(0, 10)).trim();
  const createdBy = String(options.createdBy || "manual").trim();
  const notes = String(options.notes || "").trim();

  const generated = [];
  const seen = new Set();

  while (generated.length < count) {
    const code = generateCode(prefix);
    if (seen.has(code)) continue;
    const exists = await PromoCode.exists({ code });
    if (exists) continue;
    seen.add(code);
    generated.push({
      code,
      kind: "free_month",
      planKey: "professional",
      billing: "monthly",
      status: "active",
      batchLabel,
      createdBy,
      notes,
    });
  }

  await PromoCode.insertMany(generated, { ordered: true });

  console.log(`Created ${generated.length} promo code(s):`);
  for (const entry of generated) {
    console.log(entry.code);
  }
};

const runList = async (options) => {
  const limit = Math.max(1, Math.min(500, Number.parseInt(String(options.limit || "50"), 10) || 50));
  const status = String(options.status || "").trim();
  const batchLabel = String(options.batch || "").trim();
  const query = {};

  if (status) {
    query.status = status;
  }
  if (batchLabel) {
    query.batchLabel = batchLabel;
  }

  const promoCodes = await PromoCode.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (promoCodes.length === 0) {
    console.log("No promo codes found.");
    return;
  }

  for (const promo of promoCodes) {
    console.log(
      [
        promo.code,
        promo.status,
        promo.batchLabel || "-",
        promo.redeemedByEmail || "-",
        promo.redeemedAt ? new Date(promo.redeemedAt).toISOString() : "-",
      ].join("\t")
    );
  }
};

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);

  if (!command || !["generate", "list"].includes(command)) {
    usage();
    process.exitCode = 1;
    return;
  }

  await connectDB();

  if (command === "generate") {
    await runGenerate(options);
  } else {
    await runList(options);
  }
};

try {
  await main();
} catch (error) {
  console.error("promoCodes script failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
