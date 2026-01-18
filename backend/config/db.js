// ================================
// DATABASE CONNECTION FILE
// ================================
// This file connects our backend to MongoDB database

const mongoose = require('mongoose');

/**
 * Function to connect to MongoDB
 * This is an async function because database connection takes time
 */
const connectDB = async () => {
  try {
    // Attempt to connect to MongoDB using connection string from .env file
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options ensure stable connection
      useNewUrlParser: true,      // Use new URL parser
      useUnifiedTopology: true,   // Use new connection management
    });

    // If connection successful, log the host name
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Log the database name we're using
    console.log(`📦 Database Name: ${conn.connection.name}`);
    
  } catch (error) {
    // If connection fails, show error and exit the application
    console.error(`❌ Database Connection Error: ${error.message}`);
    process.exit(1); // Exit with failure code
  }
};

// Export this function so server.js can use it
module.exports = connectDB;

/**
 * HOW THIS WORKS:
 * 1. We import mongoose (MongoDB library)
 * 2. Create a function that tries to connect to database
 * 3. If successful → log success message
 * 4. If fails → log error and stop the server
 * 5. Export function so main server file can call it
 * 
 * BEGINNER TIP:
 * - async/await is used because database operations take time
 * - Think of it like: "Wait for connection, then proceed"
 * - process.env.MONGODB_URI reads from .env file
 */