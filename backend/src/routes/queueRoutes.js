const express = require("express");
const queueController = require("../controllers/queueController");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

router.post("/:categoryId/join", authenticate, queueController.join);

module.exports = router;
