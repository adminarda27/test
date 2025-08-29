import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// --- 環境変数の取得 ---
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:3000/callback";

// 環境変数チェック
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET が設定されていません！");
  process.exit(1);
}

// --- ルートページ ---
app.get("/", (req, res) => {
  res.send('<a href="/login">🔑 Login with Discord</a>');
});

// --- Discord ログイン ---
app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// --- コールバック処理 ---
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("❌ No code returned from Discord");

  try {
    // --- トークン取得 ---
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
      return res.send(`❌ Error: ${tokenData.error_description}`);
    }

    // --- ユーザー情報取得 ---
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    res.send(`<h1>✅ ログイン成功！</h1>
              <p>ID: ${user.id}</p>
              <p>ユーザー名: ${user.username}#${user.discriminator}</p>`);
  } catch (err) {
    console.error(err);
    res.send("❌ Callback Error");
  }
});

// --- サーバー起動 ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
