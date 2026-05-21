import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../Config/db.js";
import User from "../Models/userModel.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const users = await User.find({});
  let updatedUsers = 0;

  for (const user of users) {
    let changed = false;

    if (user.termsAccepted && !user.termsAcceptedAt && user.acceptedAt) {
      user.termsAcceptedAt = user.acceptedAt;
      changed = true;
    }

    if (user.termsAccepted && !user.acceptedAt && user.termsAcceptedAt) {
      user.acceptedAt = user.termsAcceptedAt;
      changed = true;
    }

    if (!user.initialCountry && user.countryCode) {
      user.initialCountry = user.countryCode;
      changed = true;
    }

    if (!user.initialCountryName && user.countryOfResidence) {
      user.initialCountryName = user.countryOfResidence;
      changed = true;
    }

    if (user.acceptedIp === undefined) {
      user.acceptedIp = "";
      changed = true;
    }

    if (changed) {
      await user.save();
      updatedUsers += 1;
    }
  }

  console.log(JSON.stringify({ success: true, updatedUsers, totalUsers: users.length }, null, 2));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
