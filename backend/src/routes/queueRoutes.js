const express = require("express");
const queueController = require("../controllers/queueController");
const authenticate = require("../middlewares/authenticate");
const { joinLimiter } = require("../middlewares/rateLimiter");

const router = express.Router();

router.post(
  "/:categoryId/join",
  authenticate,
  joinLimiter,
  queueController.join,
);
router.get("/:categoryId/stream", authenticate, queueController.stream);

module.exports = router;
