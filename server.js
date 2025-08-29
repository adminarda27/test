import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET が設定されていません！");
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);

// 🔹 トップページ
app.get("/", (req, res) => {
  if (req.session.user) {
    res.redirect("/welcome");
  } else {
    res.send(`<a href="/login">Discordでログイン</a>`);
  }
});

// 🔹 Discord認証へ飛ばす
app.get("/login", (req, res) => {
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=identify+email`;
  res.redirect(url);
});

// 🔹 認証コールバック
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("コードがありません");

  try {
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
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.send("トークンエラー: " + tokenData.error_description);
    }

    // ユーザー情報取得
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userRes.json();

    req.session.user = userData;
    res.redirect("/welcome");
  } catch (err) {
    console.error(err);
    res.send("エラーが発生しました");
  }
});

// 🔹 認証後のページ
app.get("/welcome", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const user = req.session.user;
  res.send(`
    <h1>ようこそ ${user.username}#${user.discriminator}</h1>
    <p>ID: ${user.id}</p>
    <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" width="100"/>
    <br>
    <a href="/logout">ログアウト</a>
  `);
});

// 🔹 ログアウト
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
