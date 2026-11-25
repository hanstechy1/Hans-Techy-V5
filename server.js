import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { startUserBot, initAllSavedSessions, getActiveSessions, stopUserBot } from './botManager.js';

const app = express();
app.use(cors({ origin: CONFIG.ALLOWED_ORIGIN }));
app.use(express.json());

// 1. Endpoint ya kupata Pair Code
app.post('/api/pair', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Weka namba ya simu (mfano 2557XXXXXXXX)' });
  }

  try {
    const result = await startUserBot(phoneNumber, true);
    return res.json({ 
      success: true, 
      bot: CONFIG.BOT_NAME,
      phoneNumber,
      pairingCode: result.pairingCode 
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Imeshindwa kutoa code. Jaribu tena.' });
  }
});

// 2. Endpoint ya orodha ya sessions kwa ajili ya Dashboard
app.get('/api/sessions', (req, res) => {
  const sessions = getActiveSessions();
  res.json({ success: true, count: sessions.length, sessions });
});

// 3. Endpoint ya kusitisha session
app.post('/api/sessions/stop', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ success: false, error: 'Weka namba ya simu' });

  await stopUserBot(phoneNumber);
  res.json({ success: true, message: `Session ya ${phoneNumber} imezimwa.` });
});

// 4. Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    bot: CONFIG.BOT_NAME, 
    version: CONFIG.VERSION,
    activeSessions: getActiveSessions().length 
  });
});

// Ukurasa wa mwanzo kuangalia kama seva iko hewani
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1 style="color: #25D366;">🚀 HANS TECHY V5 Server is Running!</h1>
      <p>Multi-User WhatsApp Bot & Auto-Save Session Service is Active.</p>
    </div>
  `);
});


app.listen(CONFIG.PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 ${CONFIG.BOT_NAME} Seva imewashwa kwenye Port ${CONFIG.PORT}`);
  console.log(`===============================================`);
  
  // Washa auto-reconnect kwa sessions zote zilizopo Supabase
  await initAllSavedSessions();
});
