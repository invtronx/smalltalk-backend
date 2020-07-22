const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");

const port = process.env.PORT || 8000;

const app = express();

// register global middlewares
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// register passport-related middlewares
app.use(
  session({ secret: "sECr3TK3y", resave: false, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

require("./config/passport");

// set up a mongodb connection
const mongoConnectionString =
  process.env.MONGODB_URI || "mongodb://localhost:27017/chunk";
mongoose.connect(mongoConnectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});

// logs critical Mongodb connection events
const mongooseConnection = mongoose.connection;
mongooseConnection.on("connected", () =>
  console.log("Mongodb server is running on mongodb://localhost:27017/chunk")
);
mongooseConnection.on("error", console.error.bind(console));

// import all mongoose models
require("./models/chunk");
require("./models/comment");
require("./models/notification");
require("./models/user");

// register route handlers
app.use(require("./routes"));

// production-ready error handler: no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.json({
    errors: {
      message: err.message,
    },
  });
});

// set up our Node.js server on the specified port
app.listen(port, () => {
  console.log(`Node.js server is listening on http://localhost:${port}`);
});
