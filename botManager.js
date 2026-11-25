import makeWASocket, { Browsers, DisconnectReason, jidNormalizedUser } from '@whiskeysockets/baileys';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';
import { useSupabaseAuthState } from './supabaseAuth.js';
import { handleCommand } from './commands.js';

const logger = pino({ level: 'silent' });
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Ramani ya sessions zote zinazofanya kazi hewani sasa
const activeSockets = new Map();

export async function startUserBot(phoneNumber, isPairingRequest = false) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

  if (activeSockets.has(cleanNumber)) {
    const existing = activeSockets.get(cleanNumber);
    if (existing.sock) return existing;
  }

  const auth = await useSupabaseAuthState(cleanNumber);

  return new Promise((resolve, reject) => {
    let resolved = false;

    const sock = makeWASocket({
      auth: auth.state,
      logger,
      browser: Browsers.macOS('Chrome'),
      markOnlineOnConnect: true,
      syncFullHistory: false
    });

    const sessionObj = { sock, phoneNumber: cleanNumber, status: 'connecting' };
    activeSockets.set(cleanNumber, sessionObj);

    sock.ev.on('creds.update', async () => {
      await auth.saveCreds();
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`[${cleanNumber}] Muunganisho umefungwa. Sababu:`, statusCode);
        sessionObj.status = 'disconnected';

        await supabase.from('bot_sessions').upsert({
          phone_number: cleanNumber,
          status: 'disconnected',
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });

        if (!isLoggedOut) {
          console.log(`[${cleanNumber}] Inajaribu kujiunga upya kiotomatiki (Auto-Reconnect)...`);
          setTimeout(() => {
            startUserBot(cleanNumber, false).catch(err => console.error('Reconnect error:', err));
          }, 5000);
        } else {
          activeSockets.delete(cleanNumber);
          await supabase.from('bot_sessions').update({ is_active: false }).eq('phone_number', cleanNumber);
        }
      }

      if (connection === 'open') {
        console.log(`✅ [${cleanNumber}] Imefanikiwa kuunganishwa na ${CONFIG.BOT_NAME}!`);
        sessionObj.status = 'connected';

        await supabase.from('bot_sessions').upsert({
          phone_number: cleanNumber,
          status: 'connected',
          is_active: true,
          last_connected: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone_number' });

        if (sock.user?.id) {
          const userJid = jidNormalizedUser(sock.user.id);
          await sock.sendMessage(userJid, {
            text: `🎉 *Hongera!*\n*${CONFIG.BOT_NAME}* imeunganishwa kikamilifu kwenye namba yako.\n\nSession yako imehifadhiwa kiotomatiki (Auto-Save) kwenye Cloud.\nAndika *${CONFIG.PREFIX}menu* kuanza.`
          }).catch(() => {});
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message) continue;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || '';
        const sender = msg.key.participant || from;

        await handleCommand(sock, msg, from, text, sender);
      }
    });

    if (isPairingRequest && !auth.state.creds.registered) {
      setTimeout(async () => {
        try {
          const rawCode = await sock.requestPairingCode(cleanNumber);
          const formattedCode = rawCode.match(/.{1,4}/g)?.join('-') || rawCode;
          if (!resolved) {
            resolved = true;
            resolve({ pairingCode: formattedCode });
          }
        } catch (err) {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        }
      }, 3000);
    } else {
      if (!resolved) {
        resolved = true;
        resolve({ status: 'started' });
      }
    }
  });
}

// Inarestart sessions zote zilizopo Supabase pindi seva inapowashwa
export async function initAllSavedSessions() {
  console.log(`🔄 Inakagua sessions zilizohifadhiwa Supabase kwa ajili ya ${CONFIG.BOT_NAME}...`);
  const { data: savedSessions, error } = await supabase
    .from('bot_sessions')
    .select('phone_number, creds')
    .eq('is_active', true);

  if (error || !savedSessions) return;

  for (const session of savedSessions) {
    if (session.creds && session.creds.registered) {
      console.log(`⚡ Inajiunga upya na namba: ${session.phone_number}`);
      startUserBot(session.phone_number, false).catch(() => {});
    }
  }
}

export function getActiveSessions() {
  const list = [];
  for (const [phone, data] of activeSockets.entries()) {
    list.push({ phone, status: data.status });
  }
  return list;
}

export async function stopUserBot(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  if (activeSockets.has(cleanNumber)) {
    const session = activeSockets.get(cleanNumber);
    session.sock?.end(new Error('Stopped by admin'));
    activeSockets.delete(cleanNumber);
  }
  await supabase.from('bot_sessions').update({ 
    status: 'disconnected', 
    is_active: false,
    updated_at: new Date().toISOString()
  }).eq('phone_number', cleanNumber);
}
