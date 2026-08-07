const express = require("express");
const multer = require("multer");
const eventController = require("../controllers/eventController");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

router.post(
  "/:id/image",
  authenticate,
  authorize(["organizer"]),
  upload.single("image"),
  eventController.uploadImage,
);

module.exports = router;
