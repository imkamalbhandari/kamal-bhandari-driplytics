require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins their personal room for receiving messages
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  // User leaves their room
  socket.on('leave', (userId) => {
    socket.leave(userId);
    console.log(`User ${userId} left their room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not defined in .env file');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    const dbName = mongoose.connection.db.databaseName;
    console.log('Connected to MongoDB successfully');
    console.log(`Database: ${dbName}`);
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Driplytics API is running' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend is connected and working',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'
  });
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Sneaker routes (ML service integration)
const sneakerRoutes = require('./routes/sneakers');
app.use('/api/sneakers', sneakerRoutes);

// Favorites routes
const favoritesRoutes = require('./routes/favorites');
app.use('/api/favorites', favoritesRoutes);

// Listings routes (Trade/Marketplace)
const listingsRoutes = require('./routes/listings');
app.use('/api/listings', listingsRoutes);

// Chat routes
const chatRoutes = require('./routes/chat');
app.use('/api/chat', chatRoutes);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Payment routes (Khalti subscription)
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);

// Alert routes
const alertRoutes = require('./routes/alerts');
app.use('/api/alerts', alertRoutes);

// ==================== CRON JOB: Check Price Alerts ====================
const cron = require('node-cron');
const { checkAllAlerts } = require('./routes/alerts');

// Check alerts every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('[Cron] Running scheduled alert check...');
  await checkAllAlerts();
});

console.log('[Cron] Alert checker scheduled: every 2 hours');

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

