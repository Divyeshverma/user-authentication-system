# User Authentication System

This project implements the PDF requirements: user registration, email OTP verification, login, protected dashboard/profile, logout, and forgot-password OTP reset.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:5000`.

The OTP is printed in the server terminal. For real email delivery, connect an email service such as Nodemailer/SMTP and replace the `sendOtp` function in `server.js`.

## Environment variables

Create `.env` from `.env.example`:

```text
MONGO_URI=your-mongodb-uri
JWT_SECRET=your-long-random-secret
PORT=5000
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-gmail-app-password
```

Gmail requires an app password, not your normal Gmail password. If `EMAIL_USER` or `EMAIL_PASS` is missing, OTPs are printed in the terminal for local testing.

## Deploy on Render

1. Push this `backend` folder to GitHub.
2. Create a new Render Web Service, or use the included `render.yaml`.
3. Set the root directory to `backend` if your repository contains the full `auth-project` folder.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables: `MONGO_URI`, `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, and `PORT`.
7. Deploy and open the Render URL.

In MongoDB Atlas, allow access from Render by setting Network Access to `0.0.0.0/0` for testing, or add Render's outbound IPs if available.
