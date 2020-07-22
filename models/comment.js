const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const CommentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    chunk: { type: Schema.Types.ObjectId, ref: "Chunk", required: true },
  },
  { timestamps: true }
);

CommentSchema.methods.toJSONFor = function (user) {
  return {
    author: this.author.toShortJSON(),
    content: this.content,
    chunk: this.chunk.toJSONFor(user),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("Comment", CommentSchema);
