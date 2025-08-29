import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

bot.once("clientReady", () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

// --- メッセージ送信用関数 ---
export async function sendDiscordInfo(message) {
  try {
    const channel = await bot.channels.fetch(CHANNEL_ID);
    if (!channel) return console.error("指定チャンネルが見つかりません");
    await channel.send(message);
  } catch (err) {
    console.error("Discord送信エラー:", err);
  }
}

// Bot起動
bot.login(BOT_TOKEN);
