const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");
const {
  loginLimiter,
  registerLimiter,
} = require("../middlewares/rateLimiter");

const router = express.Router();

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.get("/me", authenticate, authController.getMe);

module.exports = router;
