require("dotenv").config();
const express = require("express");
const app = express();
const { notFoundHandler, errorHandler } = require("./error");
const middlewares = require("./middlewares");
const apiRoutes = require("./api.routes");
const { checkServerStatus } = require("../controller/serverStatus.controller");

app.use(middlewares);
app.set("view engine", "ejs");

app.get("/health", (_, res) => res.status(200).json({ message: "ok" }));
// app.use(viewRoutes);
app.get("/", (req, res) => {
  res.send("Welcome to Taghyeer Chatting Server!");
});

//! Server available or not.............
app.use(checkServerStatus);


app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;