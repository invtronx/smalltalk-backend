const router = require("express").Router();
const auth = require("../auth");

const Chunk = require("../../models/chunk");
const User = require("../../models/user");
const Comment = require("../../models/comment");

router.param("slug", (req, res, next, slug) => {
  Chunk.findOne({ slug })
    .populate("author")
    .populate("replyOn")
    .populate("comments")
    .populate("likes")
    .then((chunk) => {
      if (!user) {
        return res.status(404);
      }
      req.chunk = chunk;
    })
    .catch(next);
  next();
});

router.get("/", auth.required, (req, res, next) => {
  const query = {};
  const { author = null, tagString = null, limit = 20, offset = 0 } = req.query;
  const tags = tagString ? tagString.split(",") : null;

  Promise.all(
    author ? User.find({ username: author }).exec() : null,
    tags ? Chunk.find({ tags }).exec() : null
  )
    .then((results) => {
      const [queriedAuthor, taggedChunks] = results;
      if (queriedAuthor) {
        query._id = { $in: queriedAuthor.chunks };
      }
      if (taggedChunks) {
        query._id = { $in: taggedChunks._id };
      }
      Promise.all(
        Chunk.find(query).limit(Number(limit)).skip(Number(offset)).exec(),
        User.count(query).exec(),
        User.findById(req.authCurrentUser.id).exec()
      ).then((queryResults) => {
        const [chunks, chunkCount, currentUser] = queryResults;
        if (!currentUser) {
          return res.status(401);
        }
        return res.json({
          chunks: chunks.map((chunk) => chunk.toShortJSONFor(currentUser)),
          chunkCount: chunkCount,
        });
      });
    })
    .catch(next);
});

router.post("/", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      const freshChunk = new Chunk({
        author: currentUser._id,
        replyOn: req.body.replyOn || null,
      });
      freshChunk.updateContent(req.body.content);
      freshChunk.save().then((chunk) => {
        currentUser.addChunk(chunk._id);
      });
      res.json(freshChunk.toJSONFor(currentUser));
    })
    .catch(next);
});

router.get("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      return res.status(req.chunk.toJSONFor(currentUser));
    })
    .catch(next);
});

router.put("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser || req.chunk.author._id != req.authCurrentUser.id) {
        return res.status(401);
      }
      req.chunk.updateContent(req.body.content);
      req.chunk.save().then((updatedChunk) => {
        res.json(updatedChunk.toJSONFor(currentUser));
      });
    })
    .catch(next);
});

router.delete("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser || req.chunk.author._id != currentUser._id) {
        return res.status(401);
      }
      currentUser.deleteChunk(req.chunk._id);
      Chunk.findByIdAndDelete(req.chunk._id).exec().then();
      res.status(200);
    })
    .catch(next);
});

router.post("/:slug/comment", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      const freshComment = new Comment({
        author: currentUser._id,
        content: req.body.content,
        chunk: req.chunk._id,
      });
      freshComment.save().then((comment) => {
        req.chunk.addComment(comment);
        res.status(200);
      });
    })
    .catch(next);
});

router.put("/:slug/comment/:commentId", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser || req.chunk.author._id != currentUser._id) {
        return res.status(401);
      }
      Comment.findById(req.params.commentId)
        .exec()
        .then((comment) => {
          if (!comment) {
            return res.status(404);
          }
          comment.content = req.body.content;
          comment.save().catch(next);
          res.status(200);
        });
    })
    .catch(next);
});

router.delete("/:slug/comment/:commentId", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser || req.chunk.author._id != currentUser._id) {
        return res.status(401);
      }
      req.chunk.deleteComment(req.params.commentId);
      Comment.findByIdAndDelete(req.params.commentId).exec().catch(next);
      res.status(200);
    })
    .catch(next);
});

router.post("/:slug/like", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      req.chunk.addLike(currentUser._id);
      res.status(200);
    })
    .catch(next);
});

router.delete(":slug/like", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      req.chunk.deleteLike(currentUser._id);
      res.status(200);
    })
    .catch(next);
});

module.exports = router;
