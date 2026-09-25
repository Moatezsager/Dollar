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
import { appConfig } from '../config';
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

export interface WhatsAppChatSummary {
  id: string;
  name: string;
  type: 'channel' | 'group' | 'chat';
  messagesCount: number;
  lastMessageTime: string | null;
  lastSnippet: string;
  isReadable: boolean;
  participantsCount?: number;
}

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp_auth');
let backupDebounceTimer: NodeJS.Timeout | null = null;

/**
 * Backs up all session authentication files from disk directly to Supabase cloud (app_config table)
 * so that session credentials survive any container redeploy, update, or server restart.
 */
export async function backupAuthToStorage(): Promise<void> {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    if (files.length === 0) return;

    const bundle: Record<string, string> = {};
    for (const file of files) {
      try {
        const filePath = path.join(AUTH_DIR, file);
        if (fs.statSync(filePath).isFile()) {
          bundle[file] = fs.readFileSync(filePath, 'utf8');
        }
      } catch (e) {}
    }

    // Only backup if valid credentials exist
    if (!bundle['creds.json']) return;

    // 1. Update in-memory appConfig
    appConfig.whatsappAuth = bundle;

    // 2. Direct Sync to Supabase cloud app_config table
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { error } = await supabase
          .from('app_config')
          .upsert({ id: 1, config: appConfig });
        if (error) {
          console.error('[WhatsApp] Failed to save session into Supabase app_config:', error.message);
        } else {
          console.log(`[WhatsApp] Successfully saved ${Object.keys(bundle).length} auth files directly to Supabase cloud!`);
        }
      } catch (sbErr) {
        console.error('[WhatsApp] Supabase save exception:', sbErr);
      }
    }

    // 3. Local SQLite fallback (for offline or local runs)
    try {
      const upsertStmt = db.prepare('INSERT OR REPLACE INTO whatsapp_auth (filename, content, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
      db.transaction(() => {
        for (const file of Object.keys(bundle)) {
          upsertStmt.run(file, bundle[file]);
        }
        db.prepare('INSERT OR REPLACE INTO server_config (key, value) VALUES (?, ?)').run('whatsapp_session_backup', JSON.stringify(bundle));
      })();
    } catch (dbErr) {}

  } catch (err) {
    console.error('[WhatsApp] Error in backupAuthToStorage:', err);
  }
}

/**
 * Debounced backup to prevent overwhelming Supabase during rapid key handshakes
 */
export function queueAuthBackup(): void {
  if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
  backupDebounceTimer = setTimeout(() => {
    backupAuthToStorage().catch(console.error);
  }, 1200);
}

/**
 * Restores session authentication files from Supabase cloud into local ephemeral container auth folder.
 */
export async function restoreAuthFromStorage(): Promise<boolean> {
  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // 1. First Priority: In-memory appConfig (already loaded from Supabase)
    if (appConfig.whatsappAuth && appConfig.whatsappAuth['creds.json']) {
      const bundle = appConfig.whatsappAuth;
      const keys = Object.keys(bundle);
      console.log(`[WhatsApp] Restoring ${keys.length} session auth files from in-memory appConfig (Supabase)...`);
      for (const key of keys) {
        fs.writeFileSync(path.join(AUTH_DIR, key), bundle[key], 'utf8');
      }
      return true;
    }

    // 2. Second Priority: Direct fetch from Supabase cloud app_config
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('config')
          .eq('id', 1)
          .single();

        if (data?.config?.whatsappAuth && data.config.whatsappAuth['creds.json']) {
          const bundle = data.config.whatsappAuth as Record<string, string>;
          const keys = Object.keys(bundle);
          console.log(`[WhatsApp] Restoring ${keys.length} session auth files directly from Supabase cloud...`);
          for (const key of keys) {
            fs.writeFileSync(path.join(AUTH_DIR, key), bundle[key], 'utf8');
          }
          appConfig.whatsappAuth = bundle;
          return true;
        }
      } catch (sbErr) {
        console.warn('[WhatsApp] Supabase direct restore check warning:', sbErr);
      }
    }

    // 3. Third Priority: Existing files on local disk
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      backupAuthToStorage().catch(() => {});
      return true;
    }

    // 4. Fourth Priority: Local SQLite fallback
    try {
      const rows = db.prepare('SELECT filename, content FROM whatsapp_auth').all() as { filename: string; content: string }[];
      if (rows && rows.length > 0 && rows.some(r => r.filename === 'creds.json')) {
        console.log(`[WhatsApp] Restoring ${rows.length} session files from SQLite database...`);
        for (const row of rows) {
          fs.writeFileSync(path.join(AUTH_DIR, row.filename), row.content, 'utf8');
        }
        backupAuthToStorage().catch(() => {});
        return true;
      }
    } catch (e) {}

    return false;
  } catch (err) {
    console.error('[WhatsApp] Error restoring auth from database:', err);
    return false;
  }
}

/**
 * Checks if a saved WhatsApp session exists in Supabase cloud, appConfig, or disk.
 */
export function hasSavedSession(): boolean {
  if (appConfig.whatsappAuth && appConfig.whatsappAuth['creds.json']) return true;
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) return true;
  try {
    const row = db.prepare('SELECT 1 FROM whatsapp_auth WHERE filename = ?').get('creds.json');
    if (row) return true;
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
  private knownChats = new Map<string, WhatsAppChatSummary>();
  private isInitializing = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
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
      console.log('[WhatsApp] Initializing Baileys client with Supabase cloud persistent session...');
      
      // Step 1: Restore session files from Supabase cloud into container folder
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

      // Step 4: Handle credentials update and mirror directly to Supabase cloud
      this.sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          queueAuthBackup();
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
          console.log(`[WhatsApp] Connection closed. Status code: ${statusCode}. Preserving session in Supabase cloud...`);

          // Back up latest state before handling reconnect
          queueAuthBackup();

          this.status = 'disconnected';
          this.qrCodeUrl = null;

          // Never delete auth files on disconnect!
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

          // Immediately sync all session keys to Supabase cloud!
          await backupAuthToStorage();
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
    if (msg.key.fromMe) return;

    const mObj = msg.message;
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

    const msgTime = (typeof msg.messageTimestamp === 'number'
      ? msg.messageTimestamp
      : (msg.messageTimestamp as any)?.low || Math.floor(Date.now() / 1000)) * 1000;

    const result = await processWhatsAppMessage(chatName, text, msgTime);
    if (result.extractedCount > 0) {
      this.ratesExtractedCount += result.extractedCount;
      console.log(`[WhatsApp] Successfully extracted ${result.extractedCount} rates from chat "${chatName}"`);
    }

    const isChannel = remoteJid.includes('@newsletter');
    const isGroup = remoteJid.includes('@g.us');
    const snippet = text.replace(/\s+/g, ' ').substring(0, 100);
    const prev = this.knownChats.get(remoteJid);
    this.knownChats.set(remoteJid, {
      id: remoteJid,
      name: chatName,
      type: isChannel ? 'channel' : isGroup ? 'group' : 'chat',
      messagesCount: (prev?.messagesCount || 0) + 1,
      lastMessageTime: new Date(msgTime).toISOString(),
      lastSnippet: snippet,
      isReadable: true,
      participantsCount: prev?.participantsCount
    });
  }

  public async getReachableChats(): Promise<WhatsAppChatSummary[]> {
    if (this.sock && this.status === 'connected') {
      try {
        const groups = await (this.sock as any).groupFetchAllParticipating();
        if (groups) {
          for (const jid in groups) {
            const g = groups[jid];
            const existing = this.knownChats.get(jid);
            this.knownChats.set(jid, {
              id: jid,
              name: g.subject || existing?.name || 'مجموعة تجار أسعار',
              type: 'group',
              messagesCount: existing?.messagesCount || 0,
              lastMessageTime: existing?.lastMessageTime || null,
              lastSnippet: existing?.lastSnippet || 'متصل وقابل للقراءة بنجاح',
              isReadable: true,
              participantsCount: g.participants ? g.participants.length : undefined
            });
            if (g.subject) {
              this.chatNamesCache.set(jid, g.subject);
            }
          }
        }
      } catch (err) {
        console.warn('[WhatsApp] groupFetchAllParticipating warning:', err);
      }
    }
    return Array.from(this.knownChats.values()).sort((a, b) => {
      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return bTime - aTime;
    });
  }

  public closeOnly(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        console.log('[WhatsApp] Gracefully closing socket for server shutdown (preserving Supabase session)...');
        this.sock.end(undefined);
        this.sock = null;
      } catch (e) {}
    }
  }

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
      await this.clearAuthFromSupabaseAndDisk();
      this.status = 'disconnected';
      this.qrCodeUrl = null;
      this.phoneNumber = null;
      this.userName = null;
      this.connectedAt = null;
      this.lastError = null;
      this.reconnectAttempts = 0;
      console.log('[WhatsApp] Disconnected and session cleared permanently from Supabase cloud.');
    }
  }

  private async clearAuthFromSupabaseAndDisk(): Promise<void> {
    // 1. Remove from in-memory appConfig & Supabase cloud
    delete appConfig.whatsappAuth;
    if (supabase && supabaseAnonKey && !supabaseAnonKey.includes('dummy')) {
      try {
        await supabase.from('app_config').upsert({ id: 1, config: appConfig });
        console.log('[WhatsApp] Session removed from Supabase cloud.');
      } catch (e) {}
    }

    // 2. Clear disk files
    if (fs.existsSync(AUTH_DIR)) {
      try {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        }
      } catch (err) {}
    }

    // 3. Clear SQLite fallback
    try {
      db.prepare('DELETE FROM whatsapp_auth').run();
      db.prepare('DELETE FROM server_config WHERE key = ?').run('whatsapp_session_backup');
    } catch (dbErr) {}
  }
}

export const whatsappManager = new WhatsAppManager();
