import { Client, GatewayIntentBits } from "discord.js";

let bot;

export function initBot() {
  bot = new Client({ intents: [GatewayIntentBits.Guilds] });
  bot.login(process.env.BOT_TOKEN);
  bot.once("clientReady", () => {
    console.log(`Logged in as ${bot.user.tag}`);
  });
}

export async function sendDiscordInfo(message) {
  if (!bot) return;
  const channel = await bot.channels.fetch(process.env.DISCORD_CHANNEL_ID);
  if (!channel) return;
  channel.send(message);
}
