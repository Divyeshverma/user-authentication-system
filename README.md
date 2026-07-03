User Authentication System
A secure user authentication system built with Node.js, Express.js, MongoDB, and JWT.

# Features
- User Registration
- Email OTP Verification
- Secure Login & Logout
- JWT Authentication
- Protected Dashboard/Profile
- Forgot Password with OTP
- Password Reset
- MongoDB Database Integration

# Tech Stack
- Node.js
- Express.js
- MongoDB
- JWT
- Nodemailer
- bcrypt.js

# Installation
```bash
git clone <repository-url>
cd backend
npm install
npm start
```

Create a `.env` file and add the required environment variables:
```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
PORT=5000
```

# Project Structure
```
backend/
├── models/
├── routes/
├── middleware/
├── utils/
├── server.js
├── package.json
└── .env
```

# Future Improvements
- Refresh Token Authentication
- Rate Limiting
- Google OAuth Login
- Password Strength Validation

# License
MIT License
