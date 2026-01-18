// ================================
// CREATE ADMIN SCRIPT (RUN ONLY ONCE)
// ================================

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB using SAME URI as server
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected for admin creation'))
  .catch(err => {
    console.error('❌ MongoDB connection failed', err.message);
    process.exit(1);
  });

const createAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('⚠️ Admin already exists:', existingAdmin.email);
      process.exit();
    }

    // Create new admin
    const admin = await User.create({
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL || 'admin@cleancity.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin'
    });

    console.log('🎉 Admin created successfully!');
    console.log('📧 Email:', admin.email);
    process.exit();

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
