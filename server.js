import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Client, GatewayIntentBits } from "discord.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !BOT_TOKEN) {
  console.error("❌ 環境変数が足りません！");
  process.exit(1);
}

// --- セッション ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);

// --- 静的ファイル ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// --- Discord OAuth 認証直接コールバック用 ---
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
    if (tokenData.error) return res.send("トークンエラー: " + tokenData.error_description);

    // ユーザー情報取得
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    req.session.user = userData;

    // 認証完了 → welcome.html にリダイレクト
    res.redirect("/welcome.html");
  } catch (err) {
    console.error(err);
    res.send("エラーが発生しました");
  }
});

// --- Webサーバー起動 ---
app.listen(PORT, () => console.log(`✅ Web server running on http://localhost:${PORT}`));

// --- Discord Bot 起動 ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on("ready", () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (message.content === "!ping") message.reply("Pong!");
});

client.login(BOT_TOKEN);
