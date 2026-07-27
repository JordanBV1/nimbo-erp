try {
  const express = require("express");
  const bcrypt = require("bcryptjs");
  const dotenv = require("dotenv");
  const jwt = require("jsonwebtoken");
  const cors = require("cors");
  const helmet = require("helmet");
  const cookieParser = require("cookie-parser");
  const rateLimit = require("express-rate-limit");
  const betterSqlite3 = require("better-sqlite3");
  const app = express();
  app.get("/", (req, res) => res.send("OK"));
  app.listen(3000, "0.0.0.0", () => console.log("TEST SERVER UP"));
} catch(e) {
  console.error("FAIL:", e.message, e.stack);
  process.exit(1);
}
