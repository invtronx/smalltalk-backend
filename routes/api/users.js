const router = require("express").Router();
const auth = require("../auth");
const passport = require("passport");
const queryString = require("querystring");

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
    name: encodedName,
    followersOf,
    followingOf,
    limit = 20,
    offset = 0,
  } = req.query;
  const name = encodedName ? queryString.unescape(encodedName) : null;

  Promise.all([
    followersOf ? User.findOne({ username: followersOf }).exec() : null,
    followingOf ? User.findOne({ username: followingOf }).exec() : null,
  ])
    .then((results) => {
      const [followersOf, followingOf] = results;
      if (name) {
        query.name = { $regex: name, $options: "i" };
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
  User.findOne({ email: req.body.email })
    .exec()
    .then((user) => {
      if (user) {
        return res.status(404).json({
          email: "Email is already in use",
        });
      } else {
        const freshUser = new User({
          name: req.body.name,
          email: req.body.email,
          birthday: req.body.birthday,
          bio: req.body.bio,
          gender: req.body.gender,
        });
        freshUser.setPassword(req.body.password);
        freshUser.save().then((user) => {
          return res.json({
            currentUser: user.toAuthJSON(),
          });
        });
      }
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
        return res.redirect("/api/users/me");
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
      return res.status(404).json(info);
    }
    return res.json({
      currentUser: user.toAuthJSON(),
    });
  })(req, res, next);
});

module.exports = router;
