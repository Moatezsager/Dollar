import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WAMessage,
  WASocket
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { db, supabase, supabaseAnonKey } from '../db';
import { processWhatsAppMessage } from './scraper.service';
import { logErrorArabic } from './db.service';

export interface WhatsAppServiceStatus {
  status: 'disconnected' | 'connecting' | 'scan_qr' | 'connected' | 'error';
  qrCodeUrl: string | null;
  phoneNumber: string | null;
  userName: string | null;
  connectedAt: string | null;
  lastMessageTime: string | null;
  lastError: string | null;
  messagesReceivedCount: number;
  ratesExtractedCount: number;
  autoProcessEnabled: boolean;
  activeChatsCount: number;
  hasSavedSession: boolean;
}

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp_auth');

/**
 * Backs up all session authentication files from disk to SQLite and Supabase
 * so that session credentials survive any server reboot, container redeploy, or rebuild.
 */
export function backupAuthToStorage(): void {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    if (files.length === 0) return;

    const bundle: Record<string, string> = {};
    const upsertStmt = db.prepare('INSERT OR REPLACE INTO whatsapp_auth (filename, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    
    db.transaction(() => {
      for (const file of files) {
        try {
          const filePath = path.join(AUTH_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, 'utf8');
            upsertStmt.run(file, content);
            bundle[file] = content;
          }
        } catch (e) {}
      }
      db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run('whatsapp_session_backup', JSON.stringify(bundle));
    })();

    // Background sync to Supabase cloud storage (if configured)
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('server_config').upsert({
        key: 'whatsapp_session_backup',
        value: JSON.stringify(bundle)
      }).then(() => {}).catch(() => {});
    }
  } catch (err) {
    console.error('[WhatsApp] Error backing up session files to DB:', err);
  }
}

/**
 * Restores session authentication files from SQLite / Supabase into the local auth folder.
 */
export async function restoreAuthFromStorage(): Promise<boolean> {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // 1. Try SQLite whatsapp_auth table
    const rows = db.prepare('SELECT filename, content FROM whatsapp_auth').all() as { filename: string; content: string }[];
    if (rows && rows.length > 0) {
      console.log(`[WhatsApp] Restoring ${rows.length} session files from SQLite database...`);
      for (const row of rows) {
        fs.writeFileSync(path.join(AUTH_DIR, row.filename), row.content, 'utf8');
      }
      return true;
    }

    // 2. Try SQLite server_config bundle
    const storedBackup = db.prepare('SELECT value FROM server_config WHERE key = ?').get('whatsapp_session_backup') as any;
    if (storedBackup && storedBackup.value) {
      try {
        const bundle = JSON.parse(storedBackup.value) as Record<string, string>;
        const keys = Object.keys(bundle);
        if (keys.length > 0) {
          console.log(`[WhatsApp] Restoring ${keys.length} session files from server_config backup...`);
          for (const key of keys) {
            fs.writeFileSync(path.join(AUTH_DIR, key), bundle[key], 'utf8');
          }
          return true;
        }
      } catch (e) {}
    }

    // 3. Try Supabase cloud storage
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data } = await supabase.from('server_config').select('value').eq('key', 'whatsapp_session_backup').maybeSingle();
        if (data && data.value) {
          const bundle = JSON.parse(data.value) as Record<string, string>;
          const keys = Object.keys(bundle);
          if (keys.length > 0) {
            console.log(`[WhatsApp] Restoring ${keys.length} session files from Supabase cloud...`);
            for (const key of keys) {
              fs.writeFileSync(path.join(AUTH_DIR, key), bundle[key], 'utf8');
            }
            backupAuthToStorage();
            return true;
          }
        }
      } catch (sbErr) {
        console.warn('[WhatsApp] Supabase restore check skipped/failed:', sbErr);
      }
    }

    // 4. Check if files already exist on disk
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      backupAuthToStorage();
      return true;
    }

    return false;
  } catch (err) {
    console.error('[WhatsApp] Error restoring auth from database:', err);
    return false;
  }
}

/**
 * Checks if a saved WhatsApp session exists in disk, SQLite, or Supabase.
 */
export function hasSavedSession(): boolean {
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) return true;
  try {
    const row = db.prepare('SELECT 1 FROM whatsapp_auth WHERE filename = ?').get('creds.json');
    if (row) return true;
    const backup = db.prepare('SELECT value FROM server_config WHERE key = ?').get('whatsapp_session_backup') as any;
    if (backup && backup.value && backup.value.includes('creds.json')) return true;
  } catch (e) {}
  return false;
}

class WhatsAppManager {
  private sock: WASocket | null = null;
  private status: WhatsAppServiceStatus['status'] = 'disconnected';
  private qrCodeUrl: string | null = null;
  private phoneNumber: string | null = null;
  private userName: string | null = null;
  private connectedAt: string | null = null;
  private lastMessageTime: string | null = null;
  private lastError: string | null = null;
  private messagesReceivedCount = 0;
  private ratesExtractedCount = 0;
  private autoProcessEnabled = true;
  private activeChats = new Set<string>();
  private chatNamesCache = new Map<string, string>();
  private isInitializing = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
      try {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      } catch (e) {
        console.error('[WhatsApp] Failed to create auth directory:', e);
      }
    }
  }

  public getStatus(): WhatsAppServiceStatus {
    return {
      status: this.status,
      qrCodeUrl: this.qrCodeUrl,
      phoneNumber: this.phoneNumber,
      userName: this.userName,
      connectedAt: this.connectedAt,
      lastMessageTime: this.lastMessageTime,
      lastError: this.lastError,
      messagesReceivedCount: this.messagesReceivedCount,
      ratesExtractedCount: this.ratesExtractedCount,
      autoProcessEnabled: this.autoProcessEnabled,
      activeChatsCount: this.activeChats.size,
      hasSavedSession: hasSavedSession()
    };
  }

  public setAutoProcess(enabled: boolean) {
    this.autoProcessEnabled = enabled;
  }

  public async initClient(): Promise<void> {
    if (this.isInitializing) {
      console.log('[WhatsApp] Client is already initializing, skipping duplicate call.');
      return;
    }

    if (this.sock && this.status === 'connected') {
      console.log('[WhatsApp] Already actively connected.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isInitializing = true;
    this.status = 'connecting';
    this.lastError = null;

    try {
      console.log('[WhatsApp] Initializing Baileys client with multi-layer persistent session...');
      
      // Step 1: Restore existing session from SQLite/Supabase if needed
      await restoreAuthFromStorage();

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
        isLatest: true
      }));

      console.log(`[WhatsApp] Using Baileys version: ${version.join('.')} (isLatest: ${isLatest})`);

      const logger = pino({ level: 'silent' });

      // Step 2: Clean up previous socket if exists before creating new one
      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      // Step 3: Instantiate socket
      const makeSocketFn = (makeWASocket as any).default || makeWASocket;
      this.sock = makeSocketFn({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Dinar Indicator', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000
      });

      if (!this.sock) {
        throw new Error('Failed to create WhatsApp socket instance');
      }

      // Step 4: Handle credentials update and mirror to persistent SQLite & Supabase
      this.sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          backupAuthToStorage();
        } catch (err) {
          console.error('[WhatsApp] Error in creds.update handler:', err);
        }
      });

      // Step 5: Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[WhatsApp] New QR code generated for pairing.');
          this.status = 'scan_qr';
          try {
            this.qrCodeUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: { dark: '#000000', light: '#ffffff' }
            });
          } catch (qrErr) {
            console.error('[WhatsApp] Failed to convert QR to DataURL:', qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          console.log(`[WhatsApp] Connection closed. Status code: ${statusCode}. Preserving session in DB...`);

          // Back up latest state before handling reconnect
          backupAuthToStorage();

          this.status = 'disconnected';
          this.qrCodeUrl = null;

          // CRITICAL: NEVER delete auth files automatically on disconnect!
          // Auto-reconnect with exponential backoff
          const delay = Math.min(3000 * Math.max(1, this.reconnectAttempts + 1), 30000);
          this.reconnectAttempts++;
          console.log(`[WhatsApp] Will attempt stealth reconnection in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          
          this.reconnectTimer = setTimeout(() => {
            this.isInitializing = false;
            this.initClient().catch(console.error);
          }, delay);
        } else if (connection === 'open') {
          console.log('[WhatsApp] Connection established successfully and persistent!');
          this.status = 'connected';
          this.qrCodeUrl = null;
          this.connectedAt = new Date().toISOString();
          this.lastError = null;
          this.reconnectAttempts = 0;

          if (this.sock?.user) {
            this.phoneNumber = this.sock.user.id ? this.sock.user.id.split(':')[0] : null;
            this.userName = this.sock.user.name || null;
            console.log(`[WhatsApp] Connected permanently as: ${this.userName || 'Bot'} (${this.phoneNumber})`);
          }

          // Immediately mirror all session keys to SQLite and Supabase
          backupAuthToStorage();
        }
      });

      // Step 6: Handle incoming messages
      this.sock.ev.on('messages.upsert', async (m) => {
        if (!this.autoProcessEnabled) return;

        for (const msg of m.messages) {
          try {
            await this.handleIncomingMessage(msg);
          } catch (msgErr) {
            console.error('[WhatsApp] Error handling incoming message:', msgErr);
          }
        }
      });

    } catch (err: any) {
      console.error('[WhatsApp] Initialization error:', err);
      this.status = 'error';
      this.lastError = err?.message || String(err);
      await logErrorArabic(`خطأ في تهيئة عميل واتساب: ${this.lastError}`, 'واتساب');
    } finally {
      this.isInitializing = false;
    }
  }

  private async handleIncomingMessage(msg: WAMessage): Promise<void> {
    if (!msg.message) return;
    if (msg.key.fromMe) return; // Ignore messages sent by the bot itself

    const mObj = msg.message;
    // Extract text content from all possible WhatsApp message structures (including channels/newsletters)
    const text =
      mObj.conversation ||
      mObj.extendedTextMessage?.text ||
      mObj.imageMessage?.caption ||
      mObj.videoMessage?.caption ||
      mObj.documentMessage?.caption ||
      (mObj as any)?.ephemeralMessage?.message?.extendedTextMessage?.text ||
      (mObj as any)?.ephemeralMessage?.message?.conversation ||
      (mObj as any)?.viewOnceMessage?.message?.extendedTextMessage?.text ||
      (mObj as any)?.viewOnceMessage?.message?.conversation ||
      (mObj as any)?.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
      (mObj as any)?.viewOnceMessageV2?.message?.conversation ||
      '';

    if (!text || text.trim().length < 4) return;

    this.messagesReceivedCount++;
    this.lastMessageTime = new Date().toISOString();

    const remoteJid = msg.key.remoteJid || 'unknown';
    this.activeChats.add(remoteJid);

    // Determine chat name
    let chatName = this.chatNamesCache.get(remoteJid);
    if (!chatName) {
      if (remoteJid.includes('@g.us')) {
        chatName = 'مجموعة تجار';
        if (this.sock) {
          this.sock.groupMetadata(remoteJid).then(meta => {
            if (meta?.subject) {
              this.chatNamesCache.set(remoteJid, meta.subject);
            }
          }).catch(() => {});
        }
      } else if (remoteJid.includes('@newsletter')) {
        chatName = msg.pushName ? `قناة ${msg.pushName}` : 'قناة أسعار واتساب';
      } else {
        chatName = msg.pushName ? `محادثة (${msg.pushName})` : 'محادثة خاصة';
      }
    }

    // Convert message timestamp
    const msgTime = (typeof msg.messageTimestamp === 'number'
      ? msg.messageTimestamp
      : (msg.messageTimestamp as any)?.low || Math.floor(Date.now() / 1000)) * 1000;

    // Send to central processing engine
    const result = await processWhatsAppMessage(chatName, text, msgTime);
    if (result.extractedCount > 0) {
      this.ratesExtractedCount += result.extractedCount;
      console.log(`[WhatsApp] Successfully extracted ${result.extractedCount} rates from chat "${chatName}"`);
    }
  }

  /**
   * Graceful close on server shutdown: ends socket connection WITHOUT logging out
   * so the session remains 100% valid on WhatsApp servers and database.
   */
  public closeOnly(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        console.log('[WhatsApp] Gracefully closing socket for server shutdown (preserving session credentials)...');
        this.sock.end(undefined);
        this.sock = null;
      } catch (e) {}
    }
  }

  /**
   * Explicit manual disconnect: ONLY called when admin clicks "تسجيل الخروج وقطع الاتصال".
   * This clears credentials from disk, SQLite, and Supabase.
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        console.log('[WhatsApp] Disconnecting socket upon explicit admin request...');
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (e) {
      console.warn('[WhatsApp] Error during socket logout:', e);
    } finally {
      this.clearAuthFilesAndDb();
      this.status = 'disconnected';
      this.qrCodeUrl = null;
      this.phoneNumber = null;
      this.userName = null;
      this.connectedAt = null;
      this.lastError = null;
      this.reconnectAttempts = 0;
      console.log('[WhatsApp] Disconnected and session cleared permanently by admin.');
    }
  }

  private clearAuthFilesAndDb(): void {
    // 1. Clear disk files
    if (fs.existsSync(AUTH_DIR)) {
      try {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        }
      } catch (err) {
        console.error('[WhatsApp] Failed to clear auth files on disk:', err);
      }
    }
    // 2. Clear SQLite database
    try {
      db.prepare('DELETE FROM whatsapp_auth').run();
      db.prepare('DELETE FROM server_config WHERE key = ?').run('whatsapp_session_backup');
    } catch (dbErr) {
      console.error('[WhatsApp] Failed to clear auth files in SQLite:', dbErr);
    }
    // 3. Clear Supabase cloud storage
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      supabase.from('server_config').delete().eq('key', 'whatsapp_session_backup').then(() => {}).catch(() => {});
    }
  }
}

export const whatsappManager = new WhatsAppManager();
