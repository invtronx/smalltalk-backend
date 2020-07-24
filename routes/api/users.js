const router = require("express").Router();
const auth = require("../auth");
const passport = require("passport");

const User = require("../../models/user");

router.param("username", (req, res, next, username) => {
  User.findOne({ username })
    .exec()
    .then((user) => {
      if (!user) {
        res.sendStatus(404);
      }
      req.user = user;
      next();
    })
    .catch(next);
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

  Promise.all([
    username ? User.findOne({ username }).exec() : null,
    followersOf ? User.findOne({ username: followersOf }).exec() : null,
    followingOf ? User.findOne({ username: followingOf }).exec() : null,
  ])
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
      Promise.all([
        User.find(query).limit(Number(limit)).skip(Number(offset)).exec(),
        User.countDocuments(query).exec(),
        User.findById(req.authCurrentUser.id).exec(),
      ]).then((queryResults) => {
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
      return res.json({
        currentUser: user.toAuthJSON(),
      });
    })
    .catch(next);
});

router.get("/me", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      return res.json({
        currentUser: currentUser.toAuthJSON(),
      });
    })
    .catch(next);
});

router.put("/me", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      Object.keys(req.body).forEach((key) => {
        currentUser[key] = req.body[key];
      });
      currentUser.save().then((user) => {
        return res.json({
          currentUser: user.toAuthJSON(),
        });
      });
    })
    .catch(next);
});

router.get("/:username", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (currentUser._id.equals(req.user._id)) {
        res.redirect("/users/me");
      }
      if (!currentUser) {
        return res.status(401).send();
      }
      return res.json({
        user: req.user.toProfileJSONFor(currentUser),
      });
    })
    .catch(next);
});

router.post("/:username/follow", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      currentUser.follow(req.user);
      req.user.addNotification(currentUser._id, "Follow", null);
      return res.status(200).send();
    })
    .catch(next);
});

router.delete("/:username/follow", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      currentUser.unfollow(req.user);
      return res.status(200).send();
    })
    .catch(next);
});

router.post("/login", auth.optional, (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(404).send().json(info);
    }
    return res.json({
      currentUser: user.toAuthJSON(),
    });
  })(req, res, next);
});

module.exports = router;
