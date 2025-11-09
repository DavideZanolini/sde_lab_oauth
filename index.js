require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: process.env.SESSION_SECRET || 'keyboard cat', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, cb) => {
    // For this demo we just pass the profile through
    return cb(null, { accessToken, refreshToken, profile});
  }));
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect('/login');
}

app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.render('index', { user: req.user.profile });
  } else {
    res.render('index', { user: null });
  }
});

app.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.render('login', { user: req.user.profile });
  } else {
    res.render('login', { user: null });
  }
});

// Start OAuth flow
app.get('/auth/google', (req, res, next) => {
  if (!passport._strategy('google')) return res.status(500).send('Google OAuth not configured');
  passport.authenticate('google', {
    accessType: 'offline',
    prompt: 'consent',
    scope: ['profile', 'email'] 
  })(req, res, next);
});

// OAuth callback / redirect page
app.get('/auth/google/callback', (req, res, next) => {
  if (!passport._strategy('google')) return res.status(500).send('Google OAuth not configured');
  passport.authenticate('google', { failureRedirect: '/login' })(req, res, () => {
    res.redirect('/redirect');
  });
});

app.get('/redirect', (req, res) => {
  // This page shows a minimal confirmation after redirect
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.render('redirect', {
      user: req.user.profile,
      refreshToken: req.user.refreshToken,
      accessToken: req.user.accessToken,
    });
  } else {
    res.redirect('/login');
  }
});

app.get('/refresh', async (req, res) => {
  const refreshToken = req.user.refreshToken;
  if (!refreshToken) return res.status(400).send('No refresh token available');
  
  const body = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  };

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  const data = await response.json();
  req.user.accessToken = data.access_token;

  res.redirect('/redirect');
});

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));