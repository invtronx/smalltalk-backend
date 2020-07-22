const router = require("express").Router();
const auth = require("../auth");
const passport = require("passport");

const User = require("../../models/user");

router.param("username", (req, res, next, username) => {
  User.findOne({ username })
    .populate("followers")
    .populate("following")
    .exec()
    .then((user) => {
      if (!user) {
        res.sendStatus(404);
      }
      req.user = user;
    })
    .catch(next);
  next();
});

router.get("/", auth.required, (req, res, next) => {
  const query = {};
  const {
    username,
    followersOf,
    followingOf,
    limit = 20,
    offset = 0,
  } = req.query;

  Promise.all(
    username ? User.findOne({ username }).exec() : null,
    followersOf ? User.findOne({ username: followersOf }).exec() : null,
    followingOf ? User.findOne({ username: followingOf }).exec() : null
  )
    .then((results) => {
      const [queriedUser, followersOf, followingOf] = results;
      if (queriedUser) {
        query.username = queriedUser.username;
      }
      if (followersOf) {
        query._id = { $in: followersOf.followers };
      }
      if (followingOf) {
        query._id = { $in: followingOf.following };
      }
      Promise.all(
        User.find(query).limit(Number(limit)).skip(Number(offset)).exec(),
        User.count(query).exec(),
        User.findById(req.authCurrentUser.id).exec()
      ).then((queryResults) => {
        const [users, userCount, currentUser] = queryResults;
        return res.json({
          users: users.map((user) => user.toShortJSONFor(currentUser)),
          userCount: userCount,
        });
      });
    })
    .catch(next);
});

router.post("/", auth.optional, (req, res, next) => {
  const freshUser = new User({
    username: req.body.username,
  });
  freshUser.setPassword(req.body.password);
  freshUser
    .save()
    .then((user) => {
      return res.json(user.toAuthJSON());
    })
    .catch(next);
});

router.get("/:username", auth.required, (req, res, next) => {
  User.findOne(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (currentUser._id == req.user._id) {
        res.redirect("/users/me");
      }
      if (!currentUser) {
        return res.status(401);
      }
      return res.json(req.user.toProfileJSONFor(currentUser));
    })
    .catch(next);
});

router.get("/me", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      return res.json(currentUser.toAuthJSON());
    })
    .catch(next);
});

router.put("/me", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      const { username, birthday, bio, profilePic, gender } = req.body;
      User.findOne({ username })
        .exec()
        .then((existingUser) => {
          if (existingUser !== null) {
            throw new Error("Username is already taken");
          }
        });
      currentUser = {
        ...currentUser,
        username,
        birthday,
        bio,
        profilePic,
        gender,
      };
      currentUser.save().then((user) => {
        return res.json(user.toAuthJSON());
      });
    })
    .catch(next);
});

router.post("/:username/follow", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      currentUser.follow(req.user);
      return res.status(200);
    })
    .catch(next);
});

router.delete("/:username/follow", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      currentUser.unfollow(req.user);
      return res.status(200);
    })
    .catch(next);
});

router.post("/login", auth.optional, (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(404).json(info);
    }
    return res.json(user.toAuthJSON());
  })(req, res, next);
});

module.exports = router;
