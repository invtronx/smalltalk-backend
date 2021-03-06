const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const uniqueValidator = require("mongoose-unique-validator");
const randomString = require("crypto-random-string");
const slugify = require("slugify");

const secret = require("../config").secret;
const Notification = require("./notification");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, minlength: 3 },
    email: { type: String, required: true },
    username: {
      type: String,
      unique: true,
      index: true,
      default: function () {
        const lastName = this.name.split(" ").slice(-1)[0];
        return `${slugify(lastName)}.${randomString({
          length: 4,
          type: "url-safe",
        })}`;
      },
    },
    birthday: { type: Date },
    bio: { type: String },
    profilePic: {
      type: String,
      default: function () {
        if (this.gender === "Male") {
          return "https://thumbs.dreamstime.com/b/profile-icon-male-avatar-portrait-casual-person-silhouette-face-flat-design-vector-46846325.jpg";
        } else if (this.gender === "Female") {
          return "https://p7.hiclipart.com/preview/318/451/633/female-computer-icons-woman-business-internal-communications-avatar.jpg";
        } else {
          return "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcRIMJf32XCdIMPR005aLZbkk5TldBubjW2CfA&usqp=CAU";
        }
      },
    },
    chunks: [{ type: Schema.Types.ObjectId, ref: "Chunk" }],
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }],
    gender: {
      type: String,
      enum: ["Male", "Female", "Unspecified"],
      default: "Unspecified",
    },
    notifications: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
    passHash: { type: String },
    passSalt: { type: String },
  },
  { timestamps: true }
);

UserSchema.plugin(uniqueValidator);

UserSchema.virtual("url").get(function () {
  return `/users/${this.username}`;
});

UserSchema.methods.setPassword = function (password) {
  this.passSalt = crypto.randomBytes(32).toString("hex");
  this.passHash = crypto.pbkdf2Sync(
    password,
    this.passSalt,
    10000,
    32,
    "sha256"
  );
};

UserSchema.methods.verifyPassword = function (suppliedPassword) {
  const hash = crypto.pbkdf2Sync(
    suppliedPassword,
    this.passSalt,
    10000,
    32,
    "sha256"
  );
  return hash == this.passHash;
};

UserSchema.methods.generateJWT = function () {
  const now = new Date();
  const expireDate = now.setDate(now.getDate() + 60);

  return jwt.sign(
    {
      id: this._id,
      username: this.username,
      exp: expireDate,
    },
    secret
  );
};

UserSchema.methods.isFollower = function (userId) {
  return this.followers.indexOf(userId) !== -1;
};

UserSchema.methods.toShortJSON = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    username: this.username,
    bio: this.bio,
    gender: this.gender,
    birthday: this.birthday,
    profilePic: this.profilePic,
    followers: this.followers.length,
    following: this.following.length,
    joinedOn: this.createdAt,
  };
};

UserSchema.methods.toAuthJSON = function () {
  return {
    ...this.toShortJSON(),
    token: this.generateJWT(),
  };
};

UserSchema.methods.toProfileJSONFor = function (user) {
  return {
    ...this.toShortJSON(),
    isFollowing: this.isFollower(user._id),
  };
};

UserSchema.methods.getChunksFor = function (user) {
  return {
    chunks: this.chunks.map((chunk) => chunk.toJSONFor(user)),
  };
};

UserSchema.methods.follow = function (user) {
  this.following = this.following.concat(user._id);
  user.followers = user.followers.concat(this._id);
  this.save();
};

UserSchema.methods.unfollow = function (user) {
  this.following = this.following.filter(
    (followingUserId) => !followingUserId.equals(user._id)
  );
  user.followers = user.followers.filter(
    (followerId) => !followerId.equals(this._id)
  );
  this.save();
  user.save();
};

UserSchema.methods.addChunk = function (chunkId) {
  this.chunks = this.chunks.concat(chunkId);
  this.save();
};

UserSchema.methods.deleteChunk = function (chunkId) {
  this.chunks = this.chunks.filter(
    (userChunkId) => !userChunkId.equals(chunkId)
  );
  this.save();
};

UserSchema.methods.addNotification = function (agentId, action, redirectTo) {
  const freshNotification = new Notification({
    userAgent: agentId,
    action: action,
    redirectTo: redirectTo,
  });
  this.notifications = this.notifications.concat(freshNotification._id);
  freshNotification.save();
  this.save();
};

module.exports = mongoose.model("User", UserSchema);
