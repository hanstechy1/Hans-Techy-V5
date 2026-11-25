import { CONFIG } from './config.js';

const startTime = Date.now();

function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

export async function handleCommand(sock, msg, from, text, sender) {
  if (!text || !text.startsWith(CONFIG.PREFIX)) return;

  const [cmd, ...args] = text.slice(CONFIG.PREFIX.length).trim().split(/\s+/);
  const command = cmd.toLowerCase();

  switch (command) {
    case 'menu':
    case 'help': {
      const menuText = `╭───「 *${CONFIG.BOT_NAME}* 」───╮
│ 👑 *Version:* ${CONFIG.VERSION}
│ ⚡ *Prefix:* ${CONFIG.PREFIX}
│ 🟢 *Status:* Online & Multi-User
╰──────────────────────────╯

📌 *Amri Zinazopatikana:*
• *${CONFIG.PREFIX}ping* - Angalia spidi ya bot
• *${CONFIG.PREFIX}alive* - Hali ya mfumo
• *${CONFIG.PREFIX}uptime* - Muda ambao bot iko hewani
• *${CONFIG.PREFIX}menu* - Orodha ya amri
• *${CONFIG.PREFIX}owner* - Taarifa za msanidi

_Powered by HANS TECHY Tech Solutions_`;
      await sock.sendMessage(from, { text: menuText }, { quoted: msg });
      break;
    }

    case 'ping': {
      const start = Date.now();
      await sock.sendMessage(from, { text: 'Testing speed...' }, { quoted: msg });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `🏓 *Pong!*\n⚡ Kasi: *${latency}ms*` }, { quoted: msg });
      break;
    }

    case 'alive': {
      await sock.sendMessage(from, { 
        text: `🚀 *${CONFIG.BOT_NAME}* ipo hewani na inafanya kazi vizuri!\nAuto-Save & Reconnect zipo tayari.` 
      }, { quoted: msg });
      break;
    }

    case 'uptime': {
      const uptime = formatUptime(Date.now() - startTime);
      await sock.sendMessage(from, { text: `⏱️ *Uptime:* ${uptime}` }, { quoted: msg });
      break;
    }

    case 'owner': {
      await sock.sendMessage(from, { 
        text: `👑 *Owner:* HANS TECHY\n💬 Karibu kwa huduma na maoni.` 
      }, { quoted: msg });
      break;
    }
  }
}
