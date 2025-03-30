const express = require("express");
const mysql2 = require("mysql2");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const port = 4000;

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

app.post("/login", (req, res) => {
  const { phone_number, password } = req.body;
  
  const query = "SELECT * FROM users WHERE phone_number = ?";
  db.query(query, [phone_number], async (err, results) => {
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


    res.json({
      message: "Login successful",
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

app.post("/createUser", (req, res) => {
  const { username, phone_number, email, password } = req.body;

  const query = "INSERT INTO users (username, phone_number, email, password) VALUES (?, ?, ?, ?)";
  
  db.query(query, [username, phone_number, email, password], (err, result) => {
    if (err) {
      console.error("Error creating user:", err);
      return res.status(500).send("Error creating user");
    }

    res.status(201).json({ id: result.insertId, username, email });
  });
});


app.put("/updateUser/:id", (req, res) => {
  const { name, email, password } = req.body;
  db.query(
    "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
    [name, email, password, req.params.id],
    (err) => {
      if (err) return res.status(500).send("Error updating user");
      res.send("User updated successfully");
    }
  );
});

app.delete("/deleteUser/:id", (req, res) => {
  db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Error deleting user");
    res.send("User deleted successfully");
  });
});

app.get("/places", (req, res) => {
  const query = "SELECT * FROM places";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching places:", err);
      res.status(500).send("Error fetching places");
    } else {
      res.json(results);
    }
  });
});

app.post("/createPlace", (req, res) => {
  const { location, place_name, description } = req.body;
  const query = "INSERT INTO places (location, place_name, description, price) VALUES (?, ?, ?, ?)";
  db.query(query, [location, place_name, description, price], (err, result) => {
    if (err) {
      console.error("Error creating place:", err);
      res.status(500).send("Error creating place");
    } else {
      res.status(201).json({ id: result.insertId, location, place_name, description, price });
    }
  });
});

app.put("/updatePlace/:id", (req, res) => {
  const { location, place_name, description } = req.body;
  db.query(
    "UPDATE places SET location = ?, place_name = ?, description = ?, price = ?, WHERE id = ?",
    [location, place_name, description, req.params.id, price],
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

app.put("/updateFavorite/:id", (req, res) => {
  const { user_id, place_id } = req.body;
  db.query(
    "UPDATE favorites SET user_id = ?, place_id = ? WHERE id = ?",
    [user_id, place_id, req.params.id],
    (err) => {
      if (err) return res.status(500).send("Error updating favorite");
      res.send("Favorite updated successfully");
    }
  );
});

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

app.put("/updateReview/:id", (req, res) => {
  const { user_id, place_id, rating, review_text } = req.body;
  db.query(
    "UPDATE reviews SET user_id = ?, place_id = ?, rating = ?, review_text = ? WHERE id = ?",
    [user_id, place_id, rating, review_text, req.params.id],
    (err) => {
      if (err) return res.status(500).send("Error updating review");
      res.send("Review updated successfully");
    }
  );
});

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
