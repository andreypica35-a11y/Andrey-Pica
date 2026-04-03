# Raketero - Local Gigs & Side Hustles

A platform for local side hustles, short-term gigs, and quick jobs connecting workers and employers.

## Features

- **Gig Posting:** Employers can post short-term tasks with category, payment, and location.
- **Worker Applications:** Workers can apply for gigs and track their status.
- **Real-time Chat:** Integrated messaging between workers and employers.
- **Secure Payments:** Release payments only after gig completion and verification.
- **User Verification:** ID verification system for trusted interactions.
- **Admin Panel:** Manage users, gigs, and system health.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide React, Motion.
- **Backend:** Node.js, Express.
- **Database & Auth:** Firebase (Firestore, Auth, Storage).
- **Deployment:** Ready for Vercel or Cloud Run.

## Deployment Instructions

### 1. Environment Variables

Ensure the following environment variables are set in your deployment platform:

- `GEMINI_API_KEY`: Your Google Gemini API key.
- `APP_URL`: The public URL of your deployed application.
- `GOOGLE_APPLICATION_CREDENTIALS`: (Optional) If deploying to a custom server, path to your Firebase service account JSON.

### 2. Firebase Configuration

The application uses `firebase-applet-config.json` for Firebase settings. Ensure this file is present and contains your project details:

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_APP_ID",
  "firestoreDatabaseId": "YOUR_FIRESTORE_DATABASE_ID"
}
```

### 3. Build & Start

The application is configured with standard scripts:

- **Build:** `npm run build` (Creates the `dist` folder)
- **Start:** `npm start` (Runs the Express server serving the static files)

### 4. Security Rules

Deploy the `firestore.rules` to your Firebase project to ensure data security.

```bash
firebase deploy --only firestore:rules
```

## Local Development

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open `http://localhost:3000` in your browser.
