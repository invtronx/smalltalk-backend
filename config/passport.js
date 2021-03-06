const LocalStrategy = require("passport-local").Strategy;
const passport = require("passport");

const User = require("../models/user");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      User.findOne({ email })
        .exec()
        .then((user) => {
          if (!user) {
            return done(null, false, {
              errors: {
                email: "Email is not registered",
              },
            });
          }
          if (!user.verifyPassword(password)) {
            return done(null, false, {
              errors: {
                password: "Password is incorrect",
              },
            });
          }
          return done(null, user);
        })
        .catch(done);
    }
  )
);
