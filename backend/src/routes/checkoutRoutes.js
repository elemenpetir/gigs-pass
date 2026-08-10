const express = require("express");
const checkoutController = require("../controllers/checkoutController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.post(
  "/:categoryId/lock",
  authenticate,
  authorize(["buyer"]),
  checkoutController.lock,
);

module.exports = router;
