import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

export async function sendDiscordInfo(message) {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) await channel.send(message);
  } catch (err) {
    console.error(err);
  }
}

client.login(TOKEN);
