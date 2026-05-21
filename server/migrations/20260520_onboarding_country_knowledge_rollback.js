import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../Config/db.js";

dotenv.config();

const run = async () => {
  await connectDB();
  console.log(
    JSON.stringify(
      {
        success: true,
        message:
          "Rollback for 20260520 onboarding/country/knowledge rollout is code-first. The MongoDB schema change is additive, so no destructive data rollback is performed.",
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
