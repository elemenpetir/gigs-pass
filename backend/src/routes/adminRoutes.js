const express = require("express");
const adminController = require("../controllers/adminController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.post(
  "/orders/:id/override",
  authenticate,
  authorize(["admin"]),
  adminController.overrideOrder,
);

module.exports = router;
