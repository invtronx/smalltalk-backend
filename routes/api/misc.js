const router = require("express").Router();
const auth = require("../auth");

const User = require("../../models/user");

router.get("/notifications", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .populate({
      path: "notifications",
      populate: "userAgent",
      options: { sort: { createdAt: -1 } },
    })
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401).send();
      }
      res.json({
        notifications: currentUser.notifications.map((notification) =>
          notification.toJSON()
        ),
        notificationCount: currentUser.notifications.length,
      });
    })
    .catch(next);
});

module.exports = router;
