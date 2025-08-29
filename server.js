import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { sendDiscordInfo } from "./discordBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || "秘密鍵",
  resave: false,
  saveUninitialized: true
}));

app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify+email`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/login");

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: "identify email"
      })
    });
    const tokenData = await tokenRes.json();

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    req.session.user = { username: userData.username, discriminator: userData.discriminator };
    await sendDiscordInfo(`ユーザー: ${userData.username}#${userData.discriminator} がログイン`);

    res.redirect("/welcome");
  } catch (e) {
    console.error(e);
    res.send("OAuth2 処理でエラーが発生しました");
  }
});

app.get("/welcome", (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect("/login");

  let html = fs.readFileSync(path.join(__dirname, "public", "welcome.html"), "utf-8");
  html = html.replace("{{ username }}", user.username).replace("{{ discriminator }}", user.discriminator);
  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
