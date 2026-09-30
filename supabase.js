import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';
export const sbReady = CONFIG.supabaseUrl.startsWith('https://') && !CONFIG.supabaseUrl.includes('PASTE_') && !CONFIG.supabaseAnonKey.includes('PASTE_');
export const supabase = sbReady ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey) : null;
export function requireSupabase(){ if(!sbReady) throw new Error('Supabase belum dikonfigurasi. Isi config.js terlebih dahulu.'); return supabase; }
