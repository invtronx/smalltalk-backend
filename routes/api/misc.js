const router = require("express").Router();
const auth = require("../auth");

const User = require("../../models/user");

router.get("/notifications", auth.required, (req, res, next) => {
  User.findById(req.authCurrentUser.id)
    .populate("notifications")
    .exec()
    .then((currentUser) => {
      if (!currentUser) {
        return res.status(401);
      }
      res.json(
        currentUser.notifications.map((notification) => notification.toJSON())
      );
    })
    .catch(next);
});

module.exports = router;
