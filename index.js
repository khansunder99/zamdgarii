const express = require("express");
const mysql = require("mysql2");
const app = express();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

const twilio = require('twilio');
const crypto = require('crypto');

const accountSid = 'your_twilio_account_sid';
const authToken = 'your_twilio_auth_token';
const twilioPhoneNumber = 'your_twilio_phone_number';
const client = twilio(accountSid, authToken);

let otpStorage = {};

const port = 4000;

dotenv.config();

const cors = require("cors");
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "99367696",
  database: "zamd_garii",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database");
});

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

app.post("/login", (req, res) => {
  const { phone_number, password } = req.body;
  
  const query = "SELECT * FROM users WHERE phone_number = ?";
  db.query(query, [phone_number], async (err, results) => {
    if (err) {
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

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  });
});

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).send("Access denied");

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid token");
    req.user = user;
    next();
  });
};

app.get("/profile", authenticateToken, (req, res) => {
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

app.post("/createUsers", (req, res) => {
  const { name, email, password } = req.body;
  const query =
    "INSERT INTO users (username, password, phone_number, user_type) VALUES (?, ?, ?, ?, ?)";
  db.query(query, [name, password, phone_number, user_type], (err, result) => {
    if (err) {
      console.error("Error creating user:", err);
      res.status(500).send("Error creating user");
    } else {
      res.status(201).json({ id: result.insertId, name, email });
    }
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

app.get("/place", (req, res) => {
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

app.post("/request-password-reset", (req, res) => {
  const { phone_number } = req.body;

  const query = "SELECT * FROM users WHERE phone_number = ?";
  db.query(query, [phone_number], (err, results) => {
    if (err) {
      return res.status(500).send("Error fetching user");
    }

    if (results.length === 0) {
      return res.status(401).send("User not found");
    }

    const user = results[0];

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[phone_number] = otp;

    client.messages
      .create({
        body: `Your password reset code is: ${otp}`,
        from: twilioPhoneNumber,
        to: phone_number,
      })
      .then(message => {
        console.log('OTP sent:', message.sid);
        res.status(200).json({ message: 'OTP sent successfully' });
      })
      .catch(error => {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Error sending OTP' });
      });
  });
});

app.post("/verify-otp", (req, res) => {
  const { phone_number, otp, newPassword } = req.body;

  if (otpStorage[phone_number] === otp) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.query(
      "UPDATE users SET password = ? WHERE phone_number = ?",
      [hashedPassword, phone_number],
      (err) => {
        if (err) {
          return res.status(500).send("Error resetting password");
        }

        delete otpStorage[phone_number];

        res.status(200).json({ message: "Password reset successfully" });
      }
    );
  } else {
    return res.status(400).send("Invalid OTP");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
