module.exports = {
  secret:
    process.env.NODE_ENV === "production" ? process.env.SECRET : "sECr3TK3y",
};
