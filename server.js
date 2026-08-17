require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Database Schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  favorites: [{ type: String }]
});

const User = mongoose.model('User', userSchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Token Required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, favorites: [] });
    await newUser.save();

    const token = jwt.sign({ userId: newUser._id, name: newUser.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: { name: newUser.name, email: newUser.email, favorites: newUser.favorites } });
  } catch (err) {
    res.status(500).json({ message: 'Server error during sign up.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ userId: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { name: user.name, email: user.email, favorites: user.favorites } });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// --- WEATHER & AQI ROUTE ---
app.get('/api/weather', async (req, res) => {
  const { city } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!city) return res.status(400).json({ message: 'City is required' });

  try {
    // Fetch Coordinates & Current Weather
    const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`);
    const weatherData = await weatherRes.json();

    if (weatherRes.status !== 200) {
      return res.status(weatherRes.status).json({ message: weatherData.message || 'City not found' });
    }

    const { lat, lon } = weatherData.coord;

    // Fetch Air Quality Index Data
    const aqiRes = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`);
    const aqiData = await aqiRes.json();

    res.json({
      city: weatherData.name,
      country: weatherData.sys.country,
      temp: Math.round(weatherData.main.temp),
      description: weatherData.weather[0].description,
      aqi: aqiData.list[0].main.aqi,
      components: aqiData.list[0].components
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve weather/AQI data.' });
  }
});

// --- FAVORITES ROUTES ---

// Add Favorite
app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { city } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (!user.favorites.includes(city)) {
      user.favorites.push(city);
      await user.save();
    }
    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save favorite.' });
  }
});

// Remove Favorite
app.delete('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { city } = req.body;
    const user = await User.findById(req.user.userId);
    user.favorites = user.favorites.filter(f => f.toLowerCase() !== city.toLowerCase());
    await user.save();
    res.json({ favorites: user.favorites });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove favorite.' });
  }
});

// Serve frontend SPA (Express 5 wildcard syntax)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));