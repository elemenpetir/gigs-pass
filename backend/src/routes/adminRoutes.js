const express = require("express");
const adminController = require("../controllers/adminController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get(
  "/events",
  authenticate,
  authorize(["admin"]),
  adminController.listEvents,
);

router.get(
  "/orders",
  authenticate,
  authorize(["admin"]),
  adminController.listOrders,
);

router.post(
  "/orders/:id/override",
  authenticate,
  authorize(["admin"]),
  adminController.overrideOrder,
);

module.exports = router;
