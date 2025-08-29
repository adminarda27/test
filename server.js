import express from "express";
import fetch from "node-fetch";
import session from "express-session";
import connectRedis from "connect-redis";
import Redis from "ioredis";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sendDiscordInfo, initBot } from "./discordBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Redis セッション設定
const RedisStore = connectRedis(session);
const redisClient = new Redis(process.env.REDIS_URL);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || "秘密鍵",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1日
}));

// OAuth2 設定
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

// ルートアクセスで /login にリダイレクト
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Discord OAuth2 ログイン
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// OAuth2 コールバック
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/login");

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

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    // セッションに保存
    req.session.user = {
      username: userData.username,
      discriminator: userData.discriminator,
      email: userData.email
    };

    // Discord Bot に送信
    await sendDiscordInfo(`ログイン情報：\nユーザー: ${userData.username}#${userData.discriminator}\nメール: ${userData.email}`);

    res.redirect("/welcome");

  } catch (err) {
    console.error(err);
    res.send("認証中にエラーが発生しました。");
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

// Bot 初期化
initBot();

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
