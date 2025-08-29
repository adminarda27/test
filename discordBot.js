import fetch from "node-fetch";
import "dotenv/config";

export async function sendDiscordInfo(message) {
  const webhookURL = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookURL) return;
  await fetch(webhookURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message })
  });
}
