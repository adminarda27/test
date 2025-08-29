// server.js
import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || "https://your-app.onrender.com/callback";
const OAUTH_SCOPE = "identify";

// ---- セッション設定 ----
app.use(
  session({
    secret: "super_secret_key", // 適当に変更すること
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // HTTPSなら true
  })
);

// ---- Discord OAuth2 ログイン ----
app.get("/login", (req, res) => {
  if (req.session.user) {
    // すでにログイン済みなら直接 welcome へ
    return res.redirect("/welcome");
  }
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// ---- Discord OAuth2 コールバック ----
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/login");

  try {
    // アクセストークン取得
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error("Failed to get token:", tokenData);
      return res.redirect("/login");
    }

    // ユーザー情報取得
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // セッションに保存
    req.session.user = userData;

    res.redirect("/welcome");
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect("/login");
  }
});

// ---- 認証後のページ ----
app.get("/welcome", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  res.send(`
    <h1>Welcome, ${req.session.user.username}!</h1>
    <p>ID: ${req.session.user.id}</p>
    <a href="/logout">Logout</a>
  `);
});

// ---- ログアウト ----
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// ---- ルート ----
app.get("/", (req, res) => {
  res.send('<a href="/login">Login with Discord</a>');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
