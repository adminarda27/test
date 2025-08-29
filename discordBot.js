import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = process.env.DISCORD_BOT_TOKEN; // Bot トークン
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // 送信先チャンネルID

client.login(TOKEN);

export async function sendDiscordInfo(message) {
  if (!client.isReady()) {
    console.log("Botがまだ準備できていません");
    return;
  }

  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return console.log("チャンネルが見つかりません");
  channel.send(message);
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});
