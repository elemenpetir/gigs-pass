const express = require("express");
const multer = require("multer");
const eventController = require("../controllers/eventController");
const categoryController = require("../controllers/categoryController");
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

router.put(
  "/:id/publish",
  authenticate,
  authorize(["organizer"]),
  eventController.publish,
);

router.put(
  "/:id/suspend",
  authenticate,
  authorize(["admin"]),
  eventController.suspend,
);

router.put(
  "/:id/cancel",
  authenticate,
  authorize(["organizer", "admin"]),
  eventController.cancel,
);

router.post(
  "/:id/categories",
  authenticate,
  authorize(["organizer"]),
  categoryController.create,
);

module.exports = router;
