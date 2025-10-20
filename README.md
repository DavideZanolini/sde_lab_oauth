Google OAuth Docker demo

This repository contains a minimal Express app that demonstrates Google OAuth 2.0 and runs inside Docker. It provides two pages:

- `/login` - a simple page with a "Sign in with Google" link that starts the OAuth flow.
- `/redirect` - the OAuth callback redirect page which displays basic profile info.

Setup

1. Register OAuth credentials with Google Cloud Console:
   - Create a new project (or use an existing one).
   - Go to APIs & Services > Credentials and create an OAuth 2.0 Client ID for a Web application.
   - Set the Authorized redirect URI to `http://localhost:3000/auth/google/callback` (or your callback URL).
   - Note the Client ID and Client Secret.

2. Create a `.env` file in the project root (you can copy `.env.example`) and populate the values:

   SESSION_SECRET=your_session_secret
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

Run with Docker

Using docker-compose (recommended):

```bash
# build and start
docker compose up --build
```

The app will be available at http://localhost:3000

Run locally without Docker

```bash
cp .env.example .env
# edit .env to set your values
npm install
npm start
```

Notes

- If `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not set, the app will show a message when trying to start OAuth flow.
- This is a minimal demo. Do not use this exact setup in production without adding HTTPS, secure session store, CSRF protections, and proper environment secret handling.
