import express from "express";
import fetch from "node-fetch";
import session from "express-session";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Discord OAuth2 設定 ---
const CLIENT_ID = process.env.CLIENT_ID;         // DiscordアプリのClient ID
const CLIENT_SECRET = process.env.CLIENT_SECRET; // DiscordアプリのClient Secret
const REDIRECT_URI = process.env.REDIRECT_URI;   // Render上のURL + "/callback"
const OAUTH_SCOPE = "identify email";

// --- セッション設定 ---
app.use(session({
  secret: process.env.SESSION_SECRET || "秘密鍵",
  resave: false,
  saveUninitialized: true
}));

// --- ルートは /login へ ---
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/welcome");
  res.redirect("/login");
});

// --- ログイン ---
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/welcome"); // ログイン済みならループ防止
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${OAUTH_SCOPE}`;
  res.redirect(url);
});

// --- OAuth2 コールバック ---
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
    if (!tokenData.access_token) return res.redirect("/login");

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

    // セッション保存完了後にリダイレクト
    req.session.save(err => {
      if (err) {
        console.error(err);
        return res.redirect("/login");
      }
      res.redirect("/welcome");
    });

  } catch (err) {
    console.error(err);
    res.redirect("/login");
  }
});

// --- Welcome ページ ---
app.get("/welcome", (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const htmlPath = path.join(__dirname, "public", "welcome.html");
  let html = fs.readFileSync(htmlPath, "utf-8");

  html = html.replace("{{ username }}", req.session.user.username)
             .replace("{{ discriminator }}", req.session.user.discriminator);

  res.send(html);
});

// --- サーバ起動 ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
