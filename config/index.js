module.exports = {
  secret:
    process.env.NODE_ENV === "production" ? process.env.secret : "sECr3TK3y",
};
