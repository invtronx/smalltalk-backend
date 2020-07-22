const router = require("express").Router();

router.use("/chunks", require("./chunks"));
router.use("/users", require("./users"));
router.use("/", require("./misc"));

// Raise a 422 error on validation error
router.use((err, req, res, next) => {
  if (err.name === "ValidationError") {
    return res.status(422).json({
      errors: Object.keys(err.errors).reduce(function (errors, key) {
        errors[key] = err.errors[key].message;

        return errors;
      }, {}),
    });
  }
  return next(err);
});

// Raise a 404 error on failure to match route
router.use((req, res, next) => {
  const err = new Error("Path not found");
  err.status = 404;
  return next(err);
});

module.exports = router;
