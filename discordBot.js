import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Bot起動
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

// メッセージ送信関数
export async function sendDiscordInfo(message) {
  try {
    if (!client.isReady()) {
      await new Promise(resolve => client.once("ready", resolve));
    }
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
      await channel.send(message);
    } else {
      console.error("チャンネルが見つかりません");
    }
  } catch (err) {
    console.error("Discord送信エラー:", err);
  }
}
