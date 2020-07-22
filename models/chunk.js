const mongoose = require("mongoose");
const randomString = require("crypto-random-string");

const Notification = require("./notification");

const Schema = mongoose.Schema;

const ChunkSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, default: "Content" },
    replyOn: { type: Schema.Types.ObjectId, ref: "Chunk" },
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    tags: [{ type: String, minlength: 3 }],
    slug: { type: String, default: this.slugify },
  },
  { timestamps: true }
);

ChunkSchema.virtual("url").get(function () {
  return `/chunks/${this.slug}`;
});

ChunkSchema.methods.slugify = () =>
  randomString({ length: 12, type: "url-safe" });

ChunkSchema.methods.addComment = function (comment) {
  this.comments.push(comment._id);
  const freshNotification = new Notification({
    userAgent: comment.author,
    action: "Comment",
    redirectTo: this.url,
    notify: this.author,
  });
  freshNotification.save();
  this.save();
};

ChunkSchema.methods.deleteComment = function (commentId) {
  this.comments = this.comments.filter((id) => id !== commentId);
  this.save();
};

ChunkSchema.methods.addLike = function (userId) {
  this.likes.push(userId);
  const freshNotification = new Notification({
    userAgent: userId,
    action: "Like",
    redirectTo: this.url,
    notify: this.author,
  });
  freshNotification.save();
  this.save();
};

ChunkSchema.methods.deleteLike = function (userId) {
  this.likes = this.likes.filter((id) => id !== userId);
  this.save();
};

ChunkSchema.methods.toJSONFor = function (user) {
  return {
    author: this.author.toShortJSON(),
    content: this.content,
    replyOn: this.replyOn ? this.replyOn.toJSONFor(user) : null,
    comments: this.comments.map((comment) => comment.toJSONFor(user)),
    likes: this.likes.map((likedUser) => likedUser.toShortJSON()),
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isLiked: this.likes.indexOf(user._id) !== -1 ? true : false,
  };
};

ChunkSchema.methods.toShortJSONFor = function (user) {
  return {
    author: this.toShortJSON(),
    content: this.content,
    replyOn: this.replyOn ? this.replyOn.toShortJSONFor(user) : null,
    likes: this.likes.length,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isLiked: this.likes.indexOf(user._id) !== -1 ? true : false,
  };
};

ChunkSchema.methods.parseTags = function () {
  const tags = this.content.split(/\s/).reduce((tagList, currentWord) => {
    if (currentWord && currentWord[0] === "#") {
      const tagText = currentWord.substring(1);
      if (tagText.length >= 3) {
        return tagList.concat(tagText);
      }
    }
    return tagList;
  }, []);
  return tags;
};

ChunkSchema.methods.updateContent = function (content) {
  this.content = content;
  this.tags = this.parseTags(content);
};

module.exports = mongoose.model("Chunk", ChunkSchema);
