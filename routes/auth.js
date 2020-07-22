const jwt = require("express-jwt");
const secret = require("../config").secret;

const getTokenFromHeader = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "Bearer"
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  return null;
};

const auth = {
  required: jwt({
    secret: secret,
    credentialsRequired: true,
    algorithms: ["HS256"],
    getToken: getTokenFromHeader,
    requestProperty: "authCurrentUser",
  }),
  optional: jwt({
    secret: secret,
    credentialsRequired: false,
    algorithms: ["HS256"],
    getToken: getTokenFromHeader,
    requestProperty: "authCurrentUser",
  }),
};

module.exports = auth;
