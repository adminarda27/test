import express from "express";
import fetch from "node-fetch";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sendDiscordInfo } from "./discordBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// セッション設定
app.use(session({ secret: "秘密鍵", resave: false, saveUninitialized: true }));

// ルート変数
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const OAUTH_SCOPE = "identify email";

// / へのアクセスは /login にリダイレクト
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Discord OAuth2 ログイン
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=${OAUTH_SCOPE}`;
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
        scope: OAUTH_SCOPE,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect("/login");

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    // IP取得（X-Forwarded-For対応）
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.connection.remoteAddress;

    // Discordに送信
    const message = `ログイン情報：
ユーザー: ${userData.username}#${userData.discriminator}
メール: ${userData.email || "取得不可"}
IP: ${ip}`;
    await sendDiscordInfo(message);

    // セッション保存
    req.session.user = {
      username: userData.username,
      discriminator: userData.discriminator,
    };

    res.redirect("/welcome");
  } catch (err) {
    console.error(err);
    res.send("OAuth2処理でエラーが発生しました");
  }
});

// Welcome ページ
app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html
    .replace("{{ username }}", user.username)
    .replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

// サーバー起動
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
