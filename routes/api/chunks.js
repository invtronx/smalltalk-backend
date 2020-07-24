const mongoose = require("mongoose");
const router = require("express").Router();
const auth = require("../auth");

const Chunk = require("../../models/chunk");
const User = require("../../models/user");
const Comment = require("../../models/comment");

router.param("slug", (req, res, next, slug) => {
  Chunk.findOne({ slug })
    .populate("author")
    .then((chunk) => {
      if (!chunk) {
        return res.status(404).send();
      }
      req.chunk = chunk;
      next();
    })
    .catch(next);
});

router.get("/", auth.required, (req, res, next) => {
  const query = {};
  const {
    author = null,
    tags: tagString = null,
    limit = 20,
    offset = 0,
  } = req.query;
  const tags = tagString ? tagString.split(",") : null;

  Promise.all([
    author ? User.findOne({ username: author }).exec() : null,
    tags ? Chunk.find({ tags: { $elemMatch: { $in: tags } } }).exec() : null,
  ])
    .then((results) => {
      const [queriedAuthor, taggedChunks] = results;
      if (queriedAuthor) {
        query._id = { $in: queriedAuthor.chunks };
      }
      if (taggedChunks) {
        const taggedChunkIds = taggedChunks.map((chunk) => chunk._id);
        query._id = { $in: taggedChunkIds };
      }
      Promise.all([
        Chunk.find(query)
          .populate("author")
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({ createdAt: -1 })
          .exec(),
        Chunk.countDocuments(query).exec(),
        User.findById(req.authCurrentUser.id).exec(),
      ]).then((queryResults) => {
        const [chunks, chunkCount, currentUser] = queryResults;
        if (!currentUser) {
          return res.status(401).send();
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
        return res.status(401).send();
      }
      const freshChunk = new Chunk({
        author: currentUser._id,
        replyOn: req.body.replyOn || null,
      });
      freshChunk.updateContent(req.body.content);
      freshChunk.save().then((chunk) => {
        chunk
          .populate("author")
          .execPopulate()
          .then((populatedChunk) => {
            res.json({
              chunk: populatedChunk.toJSONFor(currentUser),
            });
          });
        currentUser.addChunk(freshChunk._id);
      });
    })
    .catch(next);
});

router.get("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      return res.json({
        chunk: req.chunk.toJSONFor(currentUser),
      });
    })
    .catch(next);
});

router.put("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (
        !currentUser ||
        !req.chunk.author._id.equals(req.authCurrentUser.id)
      ) {
        return res.status(401).send();
      }
      req.chunk.updateContent(req.body.content);
      req.chunk.save().then((updatedChunk) => {
        res.json({
          chunk: updatedChunk.toJSONFor(currentUser),
        });
      });
    })
    .catch(next);
});

router.delete("/:slug", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (
        !currentUser ||
        !req.chunk.author._id.equals(req.authCurrentUser.id)
      ) {
        return res.status(401).send().send();
      }
      currentUser.deleteChunk(req.chunk._id);
      Chunk.findByIdAndDelete(req.chunk._id)
        .exec()
        .then(() => {
          return res.status(200).send();
        });
    })
    .catch(next);
});

router.get("/:slug/comment", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      const query = {
        _id: {
          $in: req.chunk.comments,
        },
      };
      Promise.all([
        Comment.find(query).populate("author").exec(),
        Comment.countDocuments(query).exec(),
      ]).then((results) => {
        const [comments, commentCount] = results;
        return res.json({
          comments: comments.map((comment) => comment.toJSON(currentUser)),
          commentCount: commentCount,
        });
      });
    })
    .catch(next);
});

router.post("/:slug/comment", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      const freshComment = new Comment({
        author: currentUser._id,
        content: req.body.content,
      });
      freshComment.save().then((comment) => {
        req.chunk.addComment(comment);
        req.chunk.author.addNotification(
          currentUser._id,
          "Comment",
          req.chunk.url
        );
        res.status(200).send();
      });
    })
    .catch(next);
});

router.put("/:slug/comment/:commentId", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      Comment.findById(req.params.commentId)
        .exec()
        .then((comment) => {
          if (!comment.author.equals(currentUser._id)) {
            return res.status(401).send();
          }
          if (!comment) {
            return res.status(404).send();
          }
          comment.content = req.body.content;
          comment.save().catch(next);
          res.status(200).send();
        });
    })
    .catch(next);
});

router.delete("/:slug/comment/:commentId", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      Comment.findById(req.params.commentId)
        .exec()
        .then((comment) => {
          if (!comment.author.equals(currentUser._id)) {
            return res.status(401).send();
          }
        });
      req.chunk.deleteComment(req.params.commentId);
      Comment.findByIdAndDelete(req.params.commentId).exec().catch(next);
      res.status(200).send();
    })
    .catch(next);
});

router.get("/:slug/like", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      const query = {
        _id: {
          $in: req.chunk.likes,
        },
      };
      Promise.all([
        User.find(query).exec(),
        User.countDocuments(query).exec(),
      ]).then((results) => {
        const [users, userCount] = results;
        return res.json({
          users: users.map((user) => user.toShortJSON()),
          userCount: userCount,
        });
      });
    })
    .catch(next);
});

router.post("/:slug/like", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      req.chunk.addLike(currentUser._id);
      req.chunk.author.addNotification(currentUser._id, "Like", req.chunk.url);
      res.status(200).send();
    })
    .catch(next);
});

router.delete("/:slug/like", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      req.chunk.deleteLike(currentUser._id);
      res.status(200).send();
    })
    .catch(next);
});

module.exports = router;
