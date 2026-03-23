import mongoose from "mongoose";

const bannerUpdateSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    date: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    priority: { type: Number, default: 1 },
  },
  { _id: false }
);

const bannerSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      unique: true,
      default: "homepage-banner",
    },
    updates: {
      type: [bannerUpdateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
