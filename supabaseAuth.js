import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

export async function useSupabaseAuthState(phoneNumber) {
  // 1. Chukua creds za awali kutoka Supabase
  const { data: sessionRow } = await supabase
    .from('bot_sessions')
    .select('creds')
    .eq('phone_number', phoneNumber)
    .single();

  let creds;
  if (sessionRow?.creds) {
    creds = JSON.parse(JSON.stringify(sessionRow.creds), BufferJSON.reviver);
  } else {
    creds = initAuthCreds();
    await supabase.from('bot_sessions').upsert({
      phone_number: phoneNumber,
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      status: 'connecting',
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone_number' });
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          if (!ids.length) return data;
          
          const keyIds = ids.map(id => `${type}-${id}`);
          const { data: rows } = await supabase
            .from('bot_session_keys')
            .select('key_id, key_data')
            .eq('phone_number', phoneNumber)
            .in('key_id', keyIds);

          if (rows) {
            for (const row of rows) {
              const id = row.key_id.replace(`${type}-`, '');
              let value = JSON.parse(JSON.stringify(row.key_data), BufferJSON.reviver);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }
          }
          return data;
        },
        set: async (data) => {
          const upserts = [];
          const deletes = [];

          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              const keyId = `${type}-${id}`;
              if (value) {
                upserts.push({
                  phone_number: phoneNumber,
                  key_id: keyId,
                  key_data: JSON.parse(JSON.stringify(value, BufferJSON.replacer)),
                  updated_at: new Date().toISOString()
                });
              } else {
                deletes.push(keyId);
              }
            }
          }

          if (upserts.length > 0) {
            await supabase.from('bot_session_keys').upsert(upserts, { onConflict: 'phone_number,key_id' });
          }
          if (deletes.length > 0) {
            await supabase.from('bot_session_keys')
              .delete()
              .eq('phone_number', phoneNumber)
              .in('key_id', deletes);
          }
        }
      }
    },
    saveCreds: async () => {
      await supabase.from('bot_sessions').upsert({
        phone_number: phoneNumber,
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone_number' });
    }
  };
}
