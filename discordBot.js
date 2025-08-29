
import { Client, GatewayIntentBits } from "discord.js";
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const TOKEN = "YOUR_BOT_TOKEN";
const CHANNEL_ID = "限定チャンネルID";

client.on("ready", () => console.log("Bot ready"));
client.login(TOKEN);

export async function sendDiscordInfo(message) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  channel.send(message);
}
