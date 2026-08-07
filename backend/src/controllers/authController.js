const userModel = require("../models/userModel");
const authService = require("../services/authService");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["buyer", "organizer"];

const validateRegistration = (email, password, role, name) => {
  const errors = [];

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    errors.push("Invalid email format");
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!role || !ROLES.includes(role)) {
    errors.push("Role must be either buyer or organizer");
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("Name is required");
  }

  return errors;
};

const register = async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    const errors = validateRegistration(email, password, role, name);
    if (errors.length > 0) {
      return res.status(400).json({ status: "error", message: errors.join(", ") });
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ status: "error", message: "Email already registered" });
    }

    const hashedPassword = await authService.hashPassword(password);
    const user = await userModel.createUser(email, hashedPassword, role, name);

    return res.status(201).json({
      status: "success",
      message: "Registration successful",
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: "error", message: "Email and password are required" });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    const isMatch = await authService.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    const token = authService.generateJWT(user.id, user.role);

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    return res.status(200).json({
      status: "success",
      message: "User retrieved",
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
