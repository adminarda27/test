import fetch from "node-fetch";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendDiscordInfo(message) {
  if (!WEBHOOK_URL) return console.log("Webhook URLが未設定");

  await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message })
  });
}
