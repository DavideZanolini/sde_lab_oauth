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

// Comment out this strategy if you want to implement the OAuth flow manually
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
// Exercise 1 here: Change the scope in order to print all the requested information in the home page
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

app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

app.get("/calendar", ensureAuth, async (req, res) => {
	console.log("Fetching calendar events for user:", req.user);

	let events = [];
	let error = null;

	// Exercise 2 here:
	// Use the Google Calendar API to fetch the next 5 upcoming events from the user's primary calendar
	// The url to fetch is: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5'
    // Note: you need to change the scope in the /auth/google route to request calendar access:
    // "https://www.googleapis.com/auth/calendar.readonly"
	try {
        // ------------- Your code here -------------
		const r = await fetch(
			"https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5",
			{
				headers: { Authorization: `Bearer ${req.user.accessToken}` },
			}
		);
        // ---------------------------------------------

		console.log("Calendar API response status:", r.status);

		// If not OK (e.g. 401, 403, 404)
		if (!r.ok) {
			const text = await r.text(); // raw text so we can always read it
			console.log("Calendar API error body:", text);
			error = `Google Calendar API error ${r.status}: ${text}`;
		} else {
			const data = await r.json();
			events = data.items || [];
		}
	} catch (err) {
		console.error("Unexpected fetch error:", err);
		error = "Unexpected error while contacting Google Calendar API.";
	}

	res.render("calendar", {
		user: req.user.profile,
		events,
		error,
	});
});

// Assignment here: Complete the request to obtain a new access token
app.get("/refresh", ensureAuth, async (req, res) => {
    if (!req.user.refreshToken) {
        return res.status(500).render('refresh', {
            user: req.user,
            ok: false,
            oldAccessToken: '(unknown)',
            newAccessToken: null,
            payload: { error: "No refresh token available" }
        });

    }
    try {
        // ------------- Your code here -------------
        body = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            grant_type: "refresh_token",
            refresh_token: req.user.refreshToken,
        })
        // ---------------------------------------------
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body
        });

        const payload = await tokenRes.json();
        console.log("Refresh token response:", payload);

        if (!tokenRes.ok) {
            return res.status(tokenRes.status).render('refresh', {
                user: req.user,
                ok: false,
                oldAccessToken: req.user.accessToken || '(none)',
                newAccessToken: null,
                payload
            });
        }

        const newAccessToken = payload.access_token;
        // Update the user's access token in the session

        let oldAccessToken = req.user.accessToken;
        req.user.accessToken = newAccessToken;

        return res.render('refresh', {
            user: req.user,
            ok: true,
            oldAccessToken: oldAccessToken,
            newAccessToken,
            payload
        });
    } catch (error) {
        console.error("Error refreshing access token:", error);
        return res.status(500).render('refresh', {
            user: req.user,
            ok: false,
            oldAccessToken: '(unknown)',
            newAccessToken: null,
            payload: { error: error.message || String(error) }
        });
    }
});

/* Here is an alternative implementation of the OAuth flow using Passport only for storing the session
and not for handling the OAuth process itself.

// Helpers for CSRF protection
function randomBase64Url(bytes = 32) {
	return crypto.randomBytes(bytes).toString("base64url");
}

// Exercise 1 here: Change the scope in order to print all the requested information in the home page
app.get("/auth/google", (req, res, next) => {
	const state = randomBase64Url(16);
	req.session.oauthState = state;

	const params = new URLSearchParams({
		client_id: process.env.GOOGLE_CLIENT_ID,
		redirect_uri:
			process.env.GOOGLE_CALLBACK_URL ||
			`http://localhost:${PORT}/auth/google/callback`,
		response_type: "code",
        scope: "openid",
		
		access_type: "offline",
		prompt: "consent",
		state: state,
	});

	const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
	res.redirect(authUrl);
});

// OAuth callback / redirect page
app.get("/auth/google/callback", async (req, res, next) => {
	try {
		const { code, state } = req.query;
		if (!code) return res.status(400).send("Missing code");
		if (!state || state !== req.session.oauthState)
			return res.status(400).send("Invalid state");

		// Exchange code for tokens and get user info
		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code: code,
				client_id: process.env.GOOGLE_CLIENT_ID,
				client_secret: process.env.GOOGLE_CLIENT_SECRET,
				redirect_uri:
					process.env.GOOGLE_CALLBACK_URL ||
					`http://localhost:${PORT}/auth/google/callback`,
				grant_type: "authorization_code",
			}),
		});

		const tokens = await tokenRes.json();
		if (!tokenRes.ok) return res.status(400).send(tokens);

		const accessToken = tokens.access_token;

		// Fetch profile with the access token (OpenID userinfo endpoint)
		const userinfoRes = await fetch(
			"https://openidconnect.googleapis.com/v1/userinfo",
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			}
		);
		const profile = await userinfoRes.json();
		console.log("Fetched user profile:", profile);
		if (!userinfoRes.ok) return res.status(400).send(profile);

		// Hand user to Passport to create a login session
		const normalized = {
			id: profile.sub,
			displayName: profile.name,
			name: {
				familyName: profile.family_name,
				givenName: profile.given_name,
			},
			emails: profile.email
				? [{ value: profile.email, verified: profile.email_verified }]
				: [],
			photos: profile.picture ? [{ value: profile.picture }] : [],
		};
		const user = {
			id: normalized.id,
			profile: normalized,
			accessToken,
			refreshToken: tokens.refresh_token,
		};
		req.logIn(user, (loginErr) => {
			if (loginErr) {
				console.error("req.logIn error:", loginErr);
				return res.redirect("/login");
			}
			// Make sure session is saved before redirecting
			req.session.save((saveErr) => {
				if (saveErr) console.error("Session save error:", saveErr);
				return res.redirect("/redirect");
			});
		});
	} catch (error) {
		console.error("Error during OAuth callback:", error);
		res.status(500).send("OAuth flow error");
	}
});
*/


app.listen(PORT, () => console.log(`Server started on port ${PORT}`));