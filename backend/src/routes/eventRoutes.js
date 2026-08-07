const express = require("express");
const eventController = require("../controllers/eventController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.get("/", eventController.list);
router.get("/:id", eventController.getById);

router.post(
  "/",
  authenticate,
  authorize(["organizer"]),
  eventController.create,
);

router.put(
  "/:id",
  authenticate,
  authorize(["organizer"]),
  eventController.update,
);

module.exports = router;
