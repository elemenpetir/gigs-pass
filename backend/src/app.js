const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const queueRoutes = require("./routes/queueRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/checkout", checkoutRoutes);

module.exports = app;
