import express from "express";
import fetch from "node-fetch";
import geoip from "geoip-lite";
import session from "express-session";
import { Client, GatewayIntentBits } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- セッション ---
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));

// --- Discord OAuth2 ---
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

// --- Discord Bot ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });
bot.login(BOT_TOKEN);

bot.once("clientReady", () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

// --- OAuth2 ログイン ---
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// --- コールバック ---
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.send("Error: code not provided");

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

    const channel = await bot.channels.fetch(CHANNEL_ID);
    if (channel) await channel.send(message);

    req.session.user = { username: userData.username, discriminator: userData.discriminator };
    res.redirect("/welcome");

  } catch (err) {
    console.error(err);
    res.send("Error during callback");
  }
});

// --- ウェルカムページ ---
app.get("/welcome.html", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html.replace("{{ username }}", user.username).replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

// --- ルートリダイレクト ---
app.get("/", (req, res) => res.redirect("/login"));

// --- サーバー起動 ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
