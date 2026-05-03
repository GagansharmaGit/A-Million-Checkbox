import { Router } from "express";
import { env } from "../configs/env.js";
import crypto from "crypto";
import { jwtVerify, SignJWT } from "jose";
import { httpRateLimiter } from "../core/rate-limit.js";

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  maxAge: 24 * 60 * 60 * 1000
};

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

router.get("/login", httpRateLimiter({ windowMs: 60000, max: 20 }), (req, res) => {
  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = crypto.randomBytes(16).toString("hex");

  res.cookie("oauth_flow", JSON.stringify({ verifier: codeVerifier, state }), {
    httpOnly: true, maxAge: 10 * 60 * 1000
  });

  const url = new URL(`${env.OIDC_ISSUER}/oauth/authorize`);
  url.searchParams.set("client_id", env.OIDC_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${env.APP_URL}/auth/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  res.redirect(url.toString());
});

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) return res.status(400).send(`Auth Error: ${error}`);

  const flowCookieStr = req.cookies["oauth_flow"];
  if (!flowCookieStr) return res.status(400).send("No oauth flow found. Stale session.");

  const flow = JSON.parse(flowCookieStr);
  if (state !== flow.state) return res.status(400).send("State mismatch");

  try {
    const tokenRes = await fetch(`${env.OIDC_ISSUER}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: env.OIDC_CLIENT_ID,
        client_secret: env.OIDC_CLIENT_SECRET,
        redirect_uri: `${env.APP_URL}/auth/callback`,
        code,
        code_verifier: flow.verifier
      })
    });

    if (!tokenRes.ok) {
        return res.status(400).send(`Exchange failed: ${await tokenRes.text()}`);
    }

    const tokens = await tokenRes.json();

    const userInfoRes = await fetch(`${env.OIDC_ISSUER}/userinfo`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`
      }
    });

    if (!userInfoRes.ok) {
      return res.status(400).send(`Failed to fetch user info: ${await userInfoRes.text()}`);
    }

    const userInfo = await userInfoRes.json();

    const sessionJwt = await new SignJWT({
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(new TextEncoder().encode(env.SESSION_SECRET));

    res.clearCookie("oauth_flow");
    res.cookie("session_token", sessionJwt, COOKIE_OPTIONS);

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Chakra Restored - Konoha OIDC</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600&display=swap');
            body {
              margin: 0;
              padding: 0;
              background-color: #09090b;
              color: white;
              font-family: 'Inter', sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              overflow: hidden;
            }
            .glow-red {
              position: absolute;
              width: 300px;
              height: 300px;
              background: radial-gradient(circle, rgba(229,9,20,0.15) 0%, rgba(0,0,0,0) 70%);
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 0;
            }
            .card {
              background: rgba(9, 9, 11, 0.9);
              border: 1px solid rgba(229, 9, 20, 0.3);
              border-radius: 12px;
              padding: 40px;
              text-align: center;
              z-index: 10;
              box-shadow: 0 0 40px rgba(229, 9, 20, 0.1);
              max-width: 400px;
              width: 90%;
            }
            h1 {
              font-family: 'Cinzel', serif;
              color: #E50914;
              margin-bottom: 10px;
              letter-spacing: 2px;
            }
            p {
              color: #a1a1aa;
              font-size: 14px;
              line-height: 1.6;
              margin-bottom: 30px;
            }
            .btn {
              background: #E50914;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 4px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 0 15px rgba(229, 9, 20, 0.3);
            }
            .btn:hover {
              background: #cc0812;
              transform: translateY(-1px);
            }
            .icon {
              font-size: 48px;
              margin-bottom: 20px;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="glow-red"></div>
          <div class="card">
            <span class="icon">🔥</span>
            <h1>Blood Pact Sealed</h1>
            <p>Your chakra signature has been verified. The connection to the Hidden Leaf Identity Server is complete.</p>
            <button class="btn" onclick="closeWindow()">Return to Village</button>
            <p style="margin-top: 20px; font-size: 12px; opacity: 0.5;">If this window does not close automatically, please click the button.</p>
          </div>
          <script>
            function closeWindow() {
              try {
                if (window.opener) {
                  window.opener.postMessage('konoha_login_success', '*');
                }
              } catch (e) {
                console.error("Could not post message to opener", e);
              }
              window.close();
            }
            // Attempt auto-close immediately
            setTimeout(closeWindow, 500);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("[Auth] Callback error:", err);
    res.status(500).send("Internal Auth Error");
  }
});

router.get("/me", async (req, res) => {
  const token = req.cookies["session_token"];
  if (!token) return res.json({ authenticated: false });

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET));
    res.json({ authenticated: true, user: payload });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("session_token");
  res.redirect("/");
});

export default router;
