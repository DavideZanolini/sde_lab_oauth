// === Initialization of the modules required for this exercise ===
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');

// === Setup of Express app, enable session manager and initialize Passport ===
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

/**
 * === Google OAuth2 Strategy configuration: with Passport we can define the strategy for authenticating with Google ===
 * Passport is a plug-in authentication system for Node.js. It doesn’t handle login screens or sessions by itself — instead, it provides a clean, modular way to add any kind of authentication to your app.
 * You can attach different strategies depending on what you want, and in this case we are using the Google OAuth2 strategy.
*/
//    Note: Comment out this strategy if you want to implement the OAuth flow manually
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, cb) => {
    return cb(null, { accessToken, refreshToken, profile});
  }));
}

// === Middleware for avoid surf in potected routes if the user is not authenticated ===
function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect('/login');
}

// === Index route: Render the home page ===
app.get('/', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.render('index', { user: req.user.profile });
  } else {
    res.render('index', { user: null });
  }
});

// === Login route: Render the login page ===
app.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.render('login', { user: req.user.profile });
  } else {
    res.render('login', { user: null });
  }
});

// === Logut route: Close user session ===
app.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => res.redirect('/'));
  });
});

/**
 * === OAuth route: Start OAuth flow ===
 * Here we start the OAuth flow by redirecting the user to Google's OAuth 2.0 server.
 * In particular, it is the second step of the Oauth 2.0 flow, where the client redirects the user to the Authorization Server.
 * 
 * 
 * === Exercise here ===
 * In this route, you need to change the scope parameter in order to print all the requested information in the home page.
 * HINT: You can request multiple scopes by providing an array of strings.
 */
app.get('/auth/google', (req, res, next) => {
  if (!passport._strategy('google')) return res.status(500).send('Google OAuth not configured');
  passport.authenticate('google', {
    accessType: 'offline',
    prompt: 'consent',
    scope: ['openid']
  })(req, res, next);
});

/**
 * === OAuth callback route: Handles Google's response ===
 * Here we handle the redirect back from Google's OAuth 2.0 server.
 * This corresponds to Step 4 of the OAuth 2.0 flow, where our app receives the authorization code. Inside passport.authenticate, Passport then also performs Steps 5 and 6: 
 * it exchanges the authorization code for access/refresh tokens and fetches the user's profile.
 * 
 * If you want to see a manual implementation of these steps (without using Passport's built-in handling), check the commented code at the bottom of this file.
*/
app.get('/auth/google/callback', (req, res, next) => {
  if (!passport._strategy('google')) return res.status(500).send('Google OAuth not configured');
  passport.authenticate('google', { failureRedirect: '/login' })(req, res, () => {
    res.redirect('/redirect');
  });
});

// === Redirect route: Render the dashboard page with minimal information receviced from Google ===
app.get('/redirect', ensureAuth, (req, res) => {
  res.render('redirect', {
    user: req.user.profile,
    refreshToken: req.user.refreshToken,
    accessToken: req.user.accessToken,
  });
});

/**
 *  === Calendar route: Render calendar page ===
 * Here we will fetch the next 5 upcoming events from the user's primary calendar using the Google Calendar API.
 * 
 * === Final Exercise here ===
 * You need to complete the code to fetch with a GET request the events from the Google Calendar API.
 * 
 * HINT 1: the URL to fetch is: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5'
 * HINT 2: you will need to include the access token in the Authorization header as a Bearer token.
 * HINT 3: you need to change the scope in the /auth/google route to request calendar access.
 */
app.get("/calendar", ensureAuth, async (req, res) => {
	console.log("Fetching calendar events for user:", req.user);

	let events = [];
	let error = null;

	try {
        // ------------- Complete the code here ------------- //
		const r = await fetch();
        // -------------------------------------------------- //

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

/* ASSIGNMENT HERE:
*   Complete the request to obtain a new access token
*/
/**
 * === Refresh route: Refresh the access token using the refresh token ===
 * 
 * === Assignment here ===
 * You need to complete the code to request a new access token from Google's OAuth 2.0 server using the refresh token.
 * To do so you need to complete the body of the POST request to include the missing parameters.
 * 
 * HINT: all the parameters needed are commented or empty, you just need to fill them with the correct values.
 * HINT: check the errors to understand what Google expects.
 */
app.get("/refresh", ensureAuth, async (req, res) => {
  // Check if the refresh token is available
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
      // Define the body of the request

      // ------------- Complete the code here ------------- //
      body = new URLSearchParams({
          // client_id: process.env.GOOGLE_CLIENT_ID,
          // client_secret: process.env.GOOGLE_CLIENT_SECRET,
          grant_type: "",
          // refresh_token: req.user.refreshToken,
      })
      // -------------------------------------------------- //

      // Executes the request to Google and waits for the response
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body
      });

      // Storage the response
      const payload = await tokenRes.json();
      console.log("Refresh token response:", payload);

      // Check if the operation was unsuccessful
      if (!tokenRes.ok) {
          return res.status(tokenRes.status).render('refresh', {
              user: req.user,
              ok: false,
              oldAccessToken: req.user.accessToken || '(none)',
              newAccessToken: null,
              payload
          });
      }

      // Update the user's access token in the session
      const newAccessToken = payload.access_token;

      let oldAccessToken = req.user.accessToken;
      req.user.accessToken = newAccessToken;

      // Render the page with information of the successful operation
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

/**
 * === Alternative manual OAuth flow implementation (without using Passport's built-in handling) ===
 * We will use this code to illustrate the OAuth 2.0 flow steps manually, Passport is used here only for session management.
 */
/*
// Helpers for CSRF protection
function randomBase64Url(bytes = 32) {
	return crypto.randomBytes(bytes).toString("base64url");
}

// OAuth route: Start OAuth flow
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

// === Starting of the server ===
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));