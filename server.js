import express from "express";
import fetch from "node-fetch";
import session from "express-session";
import geoip from "geoip-lite";
import path from "path";
import fs from "fs";
import { sendDiscordInfo } from "./discordBot.js";

const __dirname = path.resolve();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || "supersecret",
  resave: false,
  saveUninitialized: true
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

// ルートは /login へリダイレクト
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Discord OAuth2 ログイン
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// Discord OAuth2 コールバック
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.send("No code provided.");

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
    if (!tokenData.access_token) return res.send("Failed to get access token.");

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

    await sendDiscordInfo(message);

    req.session.user = { username: userData.username, discriminator: userData.discriminator };
    res.redirect("/welcome");

  } catch (err) {
    console.error(err);
    res.send("Error during OAuth2 callback.");
  }
});

// Welcome ページ
app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html.replace("{{ username }}", user.username).replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
