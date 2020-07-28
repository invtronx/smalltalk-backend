const mongoose = require("mongoose");
const randomString = require("crypto-random-string");

const Schema = mongoose.Schema;

const slugify = () => randomString({ length: 12, type: "url-safe" });

const ChunkSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, default: "Content" },
    replyOn: { type: String },
    comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    tags: [{ type: String, minlength: 3 }],
    slug: { type: String, default: slugify },
  },
  { timestamps: true }
);

ChunkSchema.virtual("url").get(function () {
  return `/chunks/${this.slug}`;
});

ChunkSchema.methods.addComment = function (comment) {
  this.comments.push(comment._id);
  this.save();
};

ChunkSchema.methods.deleteComment = function (commentId) {
  this.comments = this.comments.filter((id) => !id.equals(commentId));
  this.save();
};

ChunkSchema.methods.addLike = function (userId) {
  this.likes.push(userId);
  this.save();
};

ChunkSchema.methods.deleteLike = function (userId) {
  this.likes = this.likes.filter((id) => !id.equals(userId));
  this.save();
};

ChunkSchema.methods.toJSONFor = function (user) {
  return {
    _id: this._id,
    author: this.author.toShortJSON(),
    content: this.content,
    slug: this.slug,
    replyOn: this.replyOn,
    comments: this.comments,
    likes: this.likes.length,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    isLiked: this.likes.indexOf(user._id) !== -1 ? true : false,
  };
};

ChunkSchema.methods.toShortJSONFor = function (user) {
  return {
    _id: this._id,
    author: this.author.toShortJSON(),
    content: this.content,
    slug: this.slug,
    replyOn: this.replyOn,
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
