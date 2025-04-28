const express = require("express");
const mysql2 = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const port = 4000;
const jwt = require("jsonwebtoken");
const JWT_SECRET = "your_super_secret_key";

const app = express();

app.use(cors({
  origin: "http://localhost:3000", // Next.js front URL
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const db = mysql2.createConnection({
  host: "localhost",
  user: "root",
  password: "Zolboo0518$",
  database: "zamd_garii",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

// ========== Middleware ==========
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });

    req.user = decoded;
    next();
  });
};

// ========== User Authentication ==========

// Signup
app.post("/createUser", async (req, res) => {
  const { username, phone_number, email, password } = req.body;

  if (!username || !phone_number || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = "INSERT INTO users (username, phone_number, email, password) VALUES (?, ?, ?, ?)";
    db.query(query, [username, phone_number, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("Error creating user:", err);
        return res.status(500).json({ error: "Error creating user" });
      }
      res.status(201).json({ id: result.insertId, username, email });
    });
  } catch (error) {
    console.error("Error hashing password:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/login", (req, res) => {
  const { identifier, password, rememberMe } = req.body;

  const query = "SELECT * FROM users WHERE phone_number = ? OR username = ?";
  db.query(query, [identifier, identifier], async (err, results) => {
    if (err) return res.status(500).send("Error fetching user");

    if (results.length === 0) return res.status(401).send("User not found");

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).send("Incorrect password");

    // Create JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: rememberMe ? "7d" : "1h"  // If remember me checked, 7 days otherwise 1 hour
    });

    // Save cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 7d or 1h
    });

    res.json({ message: "Login successful" });
  });
});

// Check Authenticated
app.get("/check-auth", verifyToken, (req, res) => {
  res.json({ message: "Authenticated", user: req.user });
});

// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

// Profile
app.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "Welcome to your profile!", user: req.user });
});

// ========== Other Endpoints ==========
// All your /places, /favorites, /reviews, /categories, etc, can stay the same!
// (No changes needed, зөв ажиллаж байна.)

// Example: get all places
app.get("/places", (req, res) => {
  const query = `
    SELECT p.id, p.place_name, p.location, p.description, p.price, i.image_url, c.category_name AS category
    FROM places p
    LEFT JOIN images i ON p.id = i.place_id
    LEFT JOIN categories c ON p.category_id = c.id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).send("Error fetching places");
    res.json(results);
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
