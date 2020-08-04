const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema(
  {
    userAgent: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: ["Like", "Comment", "Follow"],
      required: true,
    },
    redirectTo: { type: String },
  },
  { timestamps: true }
);

NotificationSchema.methods.toJSON = function () {
  return {
    _id: this._id,
    userAgent: this.userAgent.toShortJSON(),
    action: this.action,
    redirectTo: this.redirectTo,
    time: this.createdAt,
  };
};

module.exports = mongoose.model("Notification", NotificationSchema);
