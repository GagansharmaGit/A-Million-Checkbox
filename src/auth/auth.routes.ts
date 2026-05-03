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
      <html>
        <body>
          <script>
            window.opener.postMessage('konoha_login_success', '*');
            window.close();
          </script>
          <p>Login successful! You can close this window.</p>
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
