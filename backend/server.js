// ================================
// MAIN SERVER FILE
// ================================
// Entry point for the backend application

// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// ================================
// INITIALIZE EXPRESS APP
// ================================
const app = express();

// ================================
// CONNECT TO DATABASE
// ================================
// This connects to MongoDB Atlas
connectDB();

// ================================
// MIDDLEWARE CONFIGURATION
// ================================

/**
 * CORS - Cross-Origin Resource Sharing
 * Allows frontend (running on port 3000) to talk to backend (port 5000)
 */
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',  // Backup port
    'https://your-vercel-app.vercel.app'  // Add your Vercel URL here after deployment
  ],
  credentials: true,  // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization']  // Allowed headers
}));

/**
 * Body Parsers
 * These parse incoming request bodies
 */
app.use(express.json());  // Parse JSON bodies (application/json)
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded bodies (forms)

/**
 * Request Logger (Development only)
 * Logs every incoming request
 */
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// ================================
// API ROUTES
// ================================

/**
 * Health Check Route
 * Use this to test if server is running
 * URL: http://localhost:5000/api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'Server is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Welcome Route
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Clean City Rewards API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      complaints: '/api/complaints',
      rewards: '/api/rewards',
      admin: '/api/admin'
    }
  });
});

/**
 * Authentication Routes
 * Handles: register, login, profile
 */
app.use('/api/auth', require('./routes/auth'));

/**
 * Complaint Routes
 * Handles: create complaint, list, update, delete
 */
app.use('/api/complaints', require('./routes/complaints'));

/**
 * Rewards Routes
 * Handles: redeem points, leaderboard, badges
 */
app.use('/api/rewards', require('./routes/rewards'));

/**
 * Admin Routes
 * Handles: approve/reject complaints, dashboard stats
 */
app.use('/api/admin', require('./routes/admin'));

// ================================
// ERROR HANDLING MIDDLEWARE
// ================================

/**
 * 404 Handler - Route Not Found
 * This runs if no route matches the request
 */
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/profile',
      'POST /api/complaints',
      'GET /api/complaints',
      'POST /api/rewards/redeem',
      'GET /api/rewards/leaderboard'
    ]
  });
});

/**
 * Global Error Handler
 * Catches all errors thrown in the application
 */
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  
  // Log full error stack in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error stack:', err.stack);
  }
  
  // Send error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    // Only send stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ================================
// START SERVER
// ================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CLEAN CITY REWARDS API SERVER');
  console.log('='.repeat(60));
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60) + '\n');
  
  // Log available routes
  console.log('📋 Available API Routes:');
  console.log('   Authentication:');
  console.log('   - POST   /api/auth/register');
  console.log('   - POST   /api/auth/login');
  console.log('   - GET    /api/auth/profile');
  console.log('');
  console.log('   Complaints:');
  console.log('   - POST   /api/complaints');
  console.log('   - GET    /api/complaints');
  console.log('   - GET    /api/complaints/:id');
  console.log('');
  console.log('   Rewards:');
  console.log('   - POST   /api/rewards/redeem');
  console.log('   - GET    /api/rewards/leaderboard');
  console.log('');
  console.log('   Admin:');
  console.log('   - PUT    /api/admin/complaints/:id/approve');
  console.log('   - PUT    /api/admin/complaints/:id/reject');
  console.log('   - GET    /api/admin/dashboard/stats');
  console.log('');
  console.log('✨ Server ready to accept requests!\n');
});

// ================================
// GRACEFUL SHUTDOWN
// ================================

/**
 * Handle server shutdown gracefully
 * Closes database connections before exit
 */
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server');
  process.exit(0);
});

/**
 * Handle unhandled promise rejections
 * Prevents server crash on async errors
 */
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  console.error('Stack:', err.stack);
  // In production, you might want to exit the process
  // process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // In production, exit the process
  // process.exit(1);
});

// Export app for testing purposes
module.exports = app;

/**
 * ================================
 * BEGINNER EXPLANATION
 * ================================
 * 
 * HOW THIS FILE WORKS:
 * 
 * 1. IMPORTS
 *    - dotenv: Loads .env file (secret keys)
 *    - express: Web framework for creating API
 *    - cors: Allows frontend to connect
 *    - connectDB: Our database connection function
 * 
 * 2. MIDDLEWARE (app.use)
 *    - Think of middleware as "checkpoints"
 *    - Every request passes through these
 *    - Example: CORS checks if frontend is allowed
 *    - Example: express.json() converts JSON to JavaScript object
 * 
 * 3. ROUTES
 *    - Like different departments in an office
 *    - /api/auth → handles login/register
 *    - /api/complaints → handles garbage reports
 *    - /api/rewards → handles points & redemption
 *    - /api/admin → handles admin actions
 * 
 * 4. ERROR HANDLERS
 *    - 404 handler: Route doesn't exist
 *    - Global handler: Something broke in code
 * 
 * 5. START SERVER
 *    - app.listen(PORT) → Server starts listening
 *    - Like opening a restaurant for customers
 * 
 * REQUEST FLOW:
 * 
 * User → Frontend → HTTP Request → CORS Check → 
 * Body Parser → Route Handler → Database → Response → Frontend → User
 * 
 * EXAMPLE:
 * 
 * User clicks "Login"
 * ↓
 * Frontend sends: POST /api/auth/login { email, password }
 * ↓
 * CORS: ✓ Frontend allowed
 * ↓
 * express.json(): Converts JSON to object
 * ↓
 * Router: Send to auth.js
 * ↓
 * auth.js: Check email/password in database
 * ↓
 * Response: Send token back
 * ↓
 * Frontend: Save token, redirect to dashboard
 * 
 * MIDDLEWARE ORDER MATTERS!
 * - CORS must be before routes
 * - express.json() must be before routes
 * - Error handlers must be AFTER routes
 * 
 * ENVIRONMENT VARIABLES:
 * - PORT: Which port to run on (5000)
 * - NODE_ENV: development or production
 * - FRONTEND_URL: Where frontend is hosted
 * 
 * TESTING:
 * 1. Start server: npm run dev
 * 2. Visit: http://localhost:5000/api/health
 * 3. Should see: { status: "Server is running!" }
 * 
 * COMMON ERRORS:
 * 
 * "Cannot find module './routes/auth'"
 * → Make sure auth.js exists in routes folder
 * 
 * "Port 5000 already in use"
 * → Another app is using port 5000
 * → Change PORT in .env or kill that process
 * 
 * "MongoDB connection failed"
 * → Check MONGODB_URI in .env
 * → Verify MongoDB Atlas is accessible
 * 
 * PRODUCTION vs DEVELOPMENT:
 * 
 * Development:
 * - Shows detailed errors
 * - Logs every request
 * - Auto-restarts on changes (nodemon)
 * 
 * Production:
 * - Hides error details (security)
 * - Less logging (performance)
 * - Runs continuously
 */