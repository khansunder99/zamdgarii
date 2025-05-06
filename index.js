  const express = require("express");
  const mysql2 = require("mysql2");
  const bcrypt = require("bcryptjs");
  const cors = require("cors");
  const router = express.Router();
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
  

  app.get('/placeonmap', async (req, res) => {
    try {
      const [places] = await db.promise().query('SELECT id, place_name, latitude, longitude FROM places');
      res.json(places);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch places' });
    }
  });

  app.get("/api/nearby", async (req, res) => {
    const { lat, lng, radius } = req.query;
  
    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: "lat, lng, radius шаардлагатай!" });
    }
  
    const sql = `
      SELECT *,
        (6371 * acos(
          cos(radians(?)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(latitude))
        )) AS distance
      FROM places
      HAVING distance <= ?
      ORDER BY distance ASC
    `;
  
    try {
      const [rows] = await db.promise().query(sql, [lat, lng, lat, radius]);
      res.json(rows);
    } catch (err) {
      console.error("Nearby API алдаа:", err);
      res.status(500).json({ error: "Серверийн алдаа" });
    }
  });
  

  
  // Get images for a specific place
app.get('/places/:id/images', async (req, res) => {
  const placeId = req.params.id;

  try {
    const [images] = await db.promise().query('SELECT image_url FROM images WHERE place_id = ?', [placeId]);
    res.json(images);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});



// ========== PLAN API ==========

// Add a plan
app.post("/plans", verifyToken, async (req, res) => {
  const { place_id } = req.body;
  const user_id = req.user.id;

  if (!place_id) {
    return res.status(400).json({ error: "Place ID is required" });
  }

  try {
    await db.promise().query("INSERT INTO plans (user_id, place_id) VALUES (?, ?)", [user_id, place_id]);
    res.status(201).json({ message: "Plan added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add plan" });
  }
});

// Get all plans of current user
app.get("/plans", verifyToken, async (req, res) => {
  const user_id = req.user.id;

  try {
    const [plans] = await db.promise().query(
      `SELECT p.id AS plan_id, pl.id AS place_id, pl.place_name, pl.location, pl.latitude, pl.longitude
       FROM plans p
       JOIN places pl ON p.place_id = pl.id
       WHERE p.user_id = ?`,
      [user_id]
    );
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Delete a plan
app.delete("/plans/:id", verifyToken, async (req, res) => {
  const plan_id = req.params.id;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().query("DELETE FROM plans WHERE id = ? AND user_id = ?", [plan_id, user_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Plan not found or unauthorized" });
    }
    res.json({ message: "Plan deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete plan" });
  }
});


// ========== NOTE API ==========

// Add a note
app.post("/notes", verifyToken, async (req, res) => {
  const { place_id, note } = req.body;
  const user_id = req.user.id;

  if (!place_id || !note) {
    return res.status(400).json({ error: "Place ID and note are required" });
  }

  try {
    await db.promise().query("INSERT INTO notes (user_id, place_id, note) VALUES (?, ?, ?)", [user_id, place_id, note]);
    res.status(201).json({ message: "Note added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add note" });
  }
});

// Get notes of a place for current user
app.get("/notes", verifyToken, async (req, res) => {
  const { place_id } = req.query;
  const user_id = req.user.id;

  if (!place_id) {
    return res.status(400).json({ error: "Place ID is required" });
  }

  try {
    const [notes] = await db.promise().query("SELECT id, note, created_at FROM notes WHERE user_id = ? AND place_id = ?", [user_id, place_id]);
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Update a note
app.put("/notes/:id", verifyToken, async (req, res) => {
  const note_id = req.params.id;
  const { note } = req.body;
  const user_id = req.user.id;

  if (!note) return res.status(400).json({ error: "Note content required" });

  try {
    const [result] = await db.promise().query("UPDATE notes SET note = ? WHERE id = ? AND user_id = ?", [note, note_id, user_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }
    res.json({ message: "Note updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// Delete a note
app.delete("/notes/:id", verifyToken, async (req, res) => {
  const note_id = req.params.id;
  const user_id = req.user.id;

  try {
    const [result] = await db.promise().query("DELETE FROM notes WHERE id = ? AND user_id = ?", [note_id, user_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete note" });
  }
});




  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
