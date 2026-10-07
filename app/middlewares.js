// const morgan = require("morgan");
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const corsOptions = require("../config/corsOptions");
const credentials = require("../middleware/credentials");
const expressSession = require("express-session");

const middlewares = [
  // morgan("dev"),

  expressSession({
    secret: process.env.JWT_REFRESH_TOKEN,
    resave: false,
    saveUninitialized: true,
  }),

  credentials,
  cors(corsOptions),
  express.urlencoded({ extended: false, limit: "100mb" }),
  express.json({ limit: "100mb" }),
  cookieParser(),

  // REMOVE this line: express.static("uploads"),
  express.static("public"),
];

module.exports = middlewares;