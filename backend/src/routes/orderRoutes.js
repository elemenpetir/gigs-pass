const express = require("express");
const orderController = require("../controllers/orderController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["buyer"]),
  orderController.list,
);

router.post(
  "/",
  authenticate,
  authorize(["buyer"]),
  orderController.create,
);

router.post(
  "/:id/pay",
  authenticate,
  authorize(["buyer"]),
  orderController.pay,
);

module.exports = router;
