const mongoose = require("mongoose");

const User = require("./user");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  userAgent: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: {
    type: String,
    enum: ["Like", "Comment", "Follow"],
    required: true,
  },
  redirectTo: { type: String },
  notify: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

NotificationSchema.methods.toJSON = function () {
  return {
    userAgent: this.userAgent.toShortJSON(),
    action: this.action,
    redirectTo: this.redirectTo,
  };
};

NotificationSchema.post("save", function (next) {
  User.findById(this.notify).then((user) => {
    user.notifications.push(this._id);
    user.save();
  });
  next();
});

module.exports = mongoose.model("Notification", NotificationSchema);
