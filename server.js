import express from "express";
import fetch from "node-fetch";
import geoip from "geoip-lite";
import session from "express-session";
import { sendDiscordInfo } from "./discordBot.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || "テスト用秘密鍵",
  resave: false,
  saveUninitialized: true
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

// トップページ → /login にリダイレクト
app.get("/", (req, res) => {
  res.redirect("/login");
});

// ログインルート
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// コールバックルート
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Code not provided");

  try {
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
    if (!tokenData.access_token) throw new Error("No access token returned");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.connection.remoteAddress;
    const geo = geoip.lookup(ip) || {};

    const message = `ログイン情報：
ユーザー: ${userData.username}#${userData.discriminator}
メール: ${userData.email}
IP: ${ip}
地域: ${geo.region || "不明"} / ${geo.city || "不明"}`;

    try { await sendDiscordInfo(message); } catch (err) { console.error("Discord通知失敗:", err); }

    req.session.user = { username: userData.username, discriminator: userData.discriminator };
    res.redirect("/welcome");

  } catch (err) {
    console.error("OAuth処理中エラー:", err);
    res.status(500).send("認証中にエラーが発生しました");
  }
});

// ウェルカムページ
app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html;
  try {
    html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
    html = html.replaceAll("{{ username }}", user.username)
               .replaceAll("{{ discriminator }}", user.discriminator);
    res.send(html);
  } catch (err) {
    console.error("welcome.html 読み込みエラー:", err);
    res.status(500).send("ウェルカムページ読み込み失敗");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
