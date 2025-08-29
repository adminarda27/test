import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);

export async function sendDiscordInfo(message) {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  if (channel?.isTextBased()) channel.send(message);
}
