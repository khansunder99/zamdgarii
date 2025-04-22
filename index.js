const express = require("express");
const mysql2 = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const port = 4000;
const jwt = require("jsonwebtoken");
const JWT_SECRET = "your_super_secret_key";

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql2.createConnection({
  host: "localhost",
  user: "root",
  password: "Bilguungod1234",
  database: "zamd_garii",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

app.post("/createUser", async (req, res) => {
  const { username, phone_number, email, password } = req.body;

  console.log("Received Data:", req.body);

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


app.post("/login", (req, res) => {
  const { identifier, password } = req.body;

  const query = "SELECT * FROM users WHERE phone_number = ? OR username = ?";
  db.query(query, [identifier, identifier], async (err, results) => {
    if (err) {
      console.error("Error fetching user:", err);
      return res.status(500).send("Error fetching user");
    }

    if (results.length === 0) {
      return res.status(401).send("User not found");
    }

    const user = results[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send("Incorrect password");
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        phone_number: user.phone_number,
      },
      JWT_SECRET,
      { expiresIn: "4h" }
    );
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.username,
        phone_number: user.phone_number,
      },
    });
  });
});

app.get("/profile", (req, res) => {
  res.json({ message: "Welcome", user: req.user });
});

app.get("/users", (req, res) => {
  const query = "SELECT * FROM users";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching users:", err);
      res.status(500).send("Error fetching users");
    } else {
      res.json(results);
    }
  });
});

// Update User (Hash Password Before Updating)
app.put("/updateUser/:id", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    db.query(
      "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
      [name, email, hashedPassword, req.params.id],
      (err) => {
        if (err) return res.status(500).send("Error updating user");
        res.send("User updated successfully");
      }
    );
  } catch (error) {
    res.status(500).send("Error hashing password");
  }
});

app.delete("/deleteUser/:id", (req, res) => {
  db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Error deleting user");
    res.send("User deleted successfully");
  });
});

// Places Endpoints
app.get("/places", (req, res) => {
  const query = `SELECT p.id, p.place_name, p.location, p.description, p.price, i.image_url
      FROM places p
      LEFT JOIN images i ON p.id = i.place_id`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).send("Error fetching places");
    res.json(results);
  });
});

app.post("/createPlace", (req, res) => {
  const { location, place_name, description, price } = req.body;
  const query = "INSERT INTO places (location, place_name, description, price) VALUES (?, ?, ?, ?)";
  db.query(query, [location, place_name, description, price], (err, result) => {
    if (err) return res.status(500).send("Error creating place");
    res.status(201).json({ id: result.insertId, location, place_name, description, price });
  });
});

app.put("/updatePlace/:id", (req, res) => {
  const { location, place_name, description, price } = req.body;
  db.query(
    "update places SET location = ?, place_name = ?, description = ?, price = ? WHERE id = ?",
    [location, place_name, description, price, req.params.id],
    (err) => {
      if (err) return res.status(500).send("Error updating place");
      res.send("Place updated successfully");
    }
  );
});

app.delete("/deletePlace/:id", (req, res) => {
  db.query("DELETE FROM places WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Error deleting place");
    res.send("Place deleted successfully");
  });
});

// Favorites Endpoints
app.post("/createFavorite", (req, res) => {
  const { user_id, place_id } = req.body;
  db.query("INSERT INTO favorites (user_id, place_id) VALUES (?, ?)", [user_id, place_id], (err, result) => {
    if (err) return res.status(500).send("Error adding favorite");
    res.status(201).json({ id: result.insertId, user_id, place_id });
  });
});

app.get("/favorites", (req, res) => {
  db.query("SELECT * FROM favorites", (err, results) => {
    if (err) return res.status(500).send("Error fetching favorites");
    res.json(results);
  });
});

app.delete("/deleteFavorite/:id", (req, res) => {
  db.query("DELETE FROM favorites WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Error removing favorite");
    res.send("Favorite removed successfully");
  });
});

// Reviews Endpoints
app.post("/createReview", (req, res) => {
  const { user_id, place_id, review_text, rating } = req.body;
  db.query("INSERT INTO reviews (user_id, place_id, review_text, rating) VALUES (?, ?, ?, ?)", [user_id, place_id, review_text, rating], (err, result) => {
    if (err) return res.status(500).send("Error adding review");
    res.status(201).json({ id: result.insertId, user_id, place_id, review_text, rating });
  });
});

app.get("/reviews", (req, res) => {
  db.query("SELECT * FROM reviews", (err, results) => {
    if (err) return res.status(500).send("Error fetching reviews");
    res.json(results);
  });
});

app.delete("/deleteReview/:id", (req, res) => {
  db.query("DELETE FROM reviews WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Error deleting review");
    res.send("Review deleted successfully");
  });
});

app.get("/categories", (req, res) => {
  db.query("SELECT * FROM categories", (err, results) => {
    if (err) return res.status(500).send("Error fetching reviews");
    res.json(results);
  });
});

// Location Tracking
app.post("/location", (req, res) => {
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Location data is required" });
  }
  console.log(`User Location: Latitude ${latitude}, Longitude ${longitude}`);
  res.json({ message: "Location received successfully", latitude, longitude });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
