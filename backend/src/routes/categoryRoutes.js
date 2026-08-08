const express = require("express");
const categoryController = require("../controllers/categoryController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.put(
  "/:id",
  authenticate,
  authorize(["organizer"]),
  categoryController.update,
);

module.exports = router;
