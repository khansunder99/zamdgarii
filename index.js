const express = require("express");
const mysql2 = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = 4000;
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

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

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = decoded;
    next();
  });
};

// ========== User Authentication ==========
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
      if (err) return res.status(500).json({ error: "Error creating user" });
      res.status(201).json({ id: result.insertId, username, email });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", (req, res) => {
  const { identifier, password, rememberMe } = req.body;
  const query = "SELECT * FROM users WHERE phone_number = ? OR username = ?";
  db.query(query, [identifier, identifier], async (err, results) => {
    if (err) return res.status(500).send("Error fetching user");
    if (results.length === 0) return res.status(401).send("User not found");

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).send("Incorrect password");

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: rememberMe ? "7d" : "1h"
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
    });

    res.json({ message: "Login successful", userId: user.id });
  });
});

app.get("/check-auth", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Now fetch the user from DB
    const query = "SELECT id, username FROM users WHERE id = ?";
    db.query(query, [userId], (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (results.length === 0) return res.status(404).json({ message: "User not found" });

      return res.json({ user: results[0] });
    });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

app.get("/profile", verifyToken, (req, res) => {
  res.json({ message: "Welcome to your profile!", user: req.user });
});

// ========== Places ==========
app.get("/places", (req, res) => {
  const { category_id } = req.query;
  const query = `
    SELECT p.id, p.place_name, p.location, p.description, p.price, i.image_url, p.category_id 
    FROM places p
    LEFT JOIN images i ON p.id = i.place_id
    ${category_id ? `WHERE p.category_id = ${db.escape(category_id)}` : ""}
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).send("Error fetching places");
    res.json(results);
  });
});

app.get("/placeonmap", async (req, res) => {
  try {
    const [places] = await db.promise().query("SELECT id, place_name, latitude, longitude FROM places");
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

app.get("/api/nearby", async (req, res) => {
  const { lat, lng, radius } = req.query;
  if (!lat || !lng || !radius) return res.status(400).json({ error: "lat, lng, radius шаардлагатай!" });

  const sql = `
    SELECT 
      p.*,
      c.category_name,
      (
        SELECT i.image_url FROM images i 
        WHERE i.place_id = p.id 
        LIMIT 1
      ) AS image_url,
      ROUND(AVG(r.rating), 1) AS rating,
      (6371 * acos(
        cos(radians(?)) * cos(radians(p.latitude)) *
        cos(radians(p.longitude) - radians(?)) +
        sin(radians(?)) * sin(radians(p.latitude))
      )) AS distance
    FROM places p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN reviews r ON p.id = r.place_id
    GROUP BY p.id
    HAVING distance <= ?
    ORDER BY distance ASC;
  `;

  try {
    const [rows] = await db.promise().query(sql, [lat, lng, lat, radius]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Серверийн алдаа" });
  }
});

app.get("/places/:id/images", async (req, res) => {
  const placeId = req.params.id;
  try {
    const [images] = await db.promise().query("SELECT image_url FROM images WHERE place_id = ?", [placeId]);
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// ========== Plans ==========
app.post("/plans", verifyToken, async (req, res) => {
  const { place_id } = req.body;
  const user_id = req.user.id;
  if (!place_id) return res.status(400).json({ error: "Place ID is required" });

  try {
    await db.promise().query("INSERT INTO plans (user_id, place_id) VALUES (?, ?)", [user_id, place_id]);
    res.json({ message: "Planned successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add plan" });
  }
});

app.get("/plans", verifyToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    const [plans] = await db.promise().query(`
      SELECT p.id AS plan_id, pl.id AS place_id, pl.place_name, pl.location, pl.latitude, pl.longitude
      FROM plans p
      JOIN places pl ON p.place_id = pl.id
      WHERE p.user_id = ?`, [user_id]
    );
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

app.delete("/plans/:id", verifyToken, async (req, res) => {
  const plan_id = req.params.id;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().query("DELETE FROM plans WHERE id = ? AND user_id = ?", [plan_id, user_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Plan not found or unauthorized" });
    res.json({ message: "Plan deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

// ========== Notes ==========
app.post("/notes", verifyToken, async (req, res) => {
  const { place_id, note } = req.body;
  const user_id = req.user.id;
  if (!place_id || !note) return res.status(400).json({ error: "Place ID and note are required" });

  try {
    await db.promise().query("INSERT INTO notes (user_id, place_id, note) VALUES (?, ?, ?)", [user_id, place_id, note]);
    res.status(201).json({ message: "Note added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to add note" });
  }
});

app.get("/notes", verifyToken, async (req, res) => {
  const { place_id } = req.query;
  const user_id = req.user.id;
  if (!place_id) return res.status(400).json({ error: "Place ID is required" });

  try {
    const [notes] = await db.promise().query("SELECT id, note, created_at FROM notes WHERE user_id = ? AND place_id = ?", [user_id, place_id]);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

app.put("/notes/:id", verifyToken, async (req, res) => {
  const note_id = req.params.id;
  const { note } = req.body;
  const user_id = req.user.id;
  if (!note) return res.status(400).json({ error: "Note content required" });

  try {
    const [result] = await db.promise().query("UPDATE notes SET note = ? WHERE id = ? AND user_id = ?", [note, note_id, user_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Note not found or unauthorized" });
    res.json({ message: "Note updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update note" });
  }
});

app.delete("/notes/:id", verifyToken, async (req, res) => {
  const note_id = req.params.id;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().query("DELETE FROM notes WHERE id = ? AND user_id = ?", [note_id, user_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Note not found or unauthorized" });
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// ========== EXTRA APIs ==========

// Get all notes of current user
app.get("/my-notes", verifyToken, async (req, res) => {
  const user_id = req.user.id;
  try {
    const [notes] = await db.promise().query(`
      SELECT n.id AS note_id, n.note, n.created_at, p.place_name, p.id AS place_id
      FROM notes n
      JOIN places p ON n.place_id = p.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
    `, [user_id]);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user notes" });
  }
});

// Places that have notes
app.get("/places-with-notes", async (req, res) => {
  try {
    const [results] = await db.promise().query(`
      SELECT DISTINCT p.id, p.place_name, p.location
      FROM places p
      JOIN notes n ON p.id = n.place_id
    `);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch places with notes" });
  }
});

// Public notes for a place
app.get("/notes/public/:place_id", async (req, res) => {
  const place_id = req.params.place_id;
  try {
    const [notes] = await db.promise().query(`
      SELECT n.id, n.note, n.created_at, u.username
      FROM notes n
      JOIN users u ON n.user_id = u.id
      WHERE n.place_id = ?
      ORDER BY n.created_at DESC
    `, [place_id]);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch public notes" });
  }
});

// Analytics — Note & Plan count per place
app.get("/places/stats", async (req, res) => {
  try {
    const [stats] = await db.promise().query(`
      SELECT p.id AS place_id, p.place_name,
        COUNT(DISTINCT pl.id) AS plan_count,
        COUNT(DISTINCT n.id) AS note_count
      FROM places p
      LEFT JOIN plans pl ON p.id = pl.place_id
      LEFT JOIN notes n ON p.id = n.place_id
      GROUP BY p.id
    `);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch place stats" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
