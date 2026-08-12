const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get(
  "/event/:id/overview",
  authenticate,
  authorize(["organizer"]),
  analyticsController.eventOverview,
);

router.get(
  "/platform/overview",
  authenticate,
  authorize(["admin"]),
  analyticsController.platformOverview,
);

module.exports = router;