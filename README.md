# 🏙️ Clean City Rewards

A civic engagement platform where citizens report garbage issues and earn rewards after verification by municipal admins.

---

## 🧠 Project Overview

Clean City Rewards is a platform designed for Indian cities to encourage citizens to report cleanliness issues. Citizens can upload photos with GPS location. Municipal admins review and approve complaints. Approved complaints earn reward points that citizens can redeem.

---

## 🚀 Features

### 🧑‍💻 Citizen
- Register & login with JWT
- Submit garbage complaints with photo and location
- View own complaint status and rewards
- Secure authentication

### 👮 Admin
- View all complaints
- Approve or reject complaints
- Track cleanup proof and rewards
- Dashboard stats for quick insights

---

## 💻 Tech Stack

| Purpose | Technology |
|---------|------------|
| Frontend | Next.js (React) |
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| Authentication | JWT |
| Image Storage | Cloudinary |
| Dev Tools | Nodemon, Postman |

---

## 📁 Project Structure

<img width="538" height="499" alt="Screenshot 2026-01-18 230932" src="https://github.com/user-attachments/assets/30557085-106d-4d0e-8550-2e3cf117b3bf" />


---

## ⚙️ Setup Instructions (Local Development)

### Prerequisites
- Node.js installed
- MongoDB Atlas account
- Cloudinary account

---

### 1️⃣ Clone the repository

```bash
git clone https://github.com/ankurmittal9081/clean-city-rewards.git
cd clean-city-rewards/backend
2️⃣ Install backend dependencies
npm install

3️⃣ Create .env file
Create .env inside backend/ and add:

MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=admin@cleancity.com
ADMIN_PASSWORD=Admin@123456


⚠️ Do NOT commit .env to GitHub.

4️⃣ Create admin account (run once)
node create-admin.js

5️⃣ Start backend server
npm run devServer runs at:

http://localhost:5000


Test health check:

GET http://localhost:5000/api/health
📡 API Endpoints
Authentication
POST /api/auth/register
POST /api/auth/login
GET /api/auth/profile  (Protected)


Complaints
POST /api/complaints
GET /api/complaints
GET /api/complaints/:id
PUT /api/complaints/:id/upvote
DELETE /api/complaints/:id

Admin (Admin token required)
PUT /api/admin/complaints/:id/approve
PUT /api/admin/complaints/:id/reject
PUT /api/admin/complaints/:id/cleanup-proof
GET /api/admin/dashboard/stats

<img width="730" height="324" alt="image" src="https://github.com/user-attachments/assets/9d31f38c-c74b-43d9-92ad-da72effa09a6" />

📌 Deployment
Backend (render.com)

Import repo
Set environment variables
Deploy

Frontend (vercel.com)

Import repo
Set environment variables
Deploy

📈 Future Enhancements

React/Next.js frontend
Leaderboard & badge UI
Google Maps integration
Push notifications
SMS/Email reminders

🙌 Author

Ankur Mittal
Engineering Student | Full Stack Developer
Portfolio: https://github.com/ankurmittal9081

