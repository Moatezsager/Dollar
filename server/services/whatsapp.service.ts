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
}

const AUTH_DIR = path.resolve(process.cwd(), 'whatsapp_auth');

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
  private maxReconnectAttempts = 5;

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
      activeChatsCount: this.activeChats.size
    };
  }

  public setAutoProcess(enabled: boolean) {
    this.autoProcessEnabled = enabled;
  }

  public async initClient(): Promise<void> {
    if (this.isInitializing) {
      console.log('[WhatsApp] Client is already initializing...');
      return;
    }

    if (this.sock && this.status === 'connected') {
      console.log('[WhatsApp] Already connected.');
      return;
    }

    this.isInitializing = true;
    this.status = 'connecting';
    this.lastError = null;

    try {
      console.log('[WhatsApp] Initializing Baileys client...');
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307] as [number, number, number],
        isLatest: true
      }));

      console.log(`[WhatsApp] Using Baileys version: ${version.join('.')} (isLatest: ${isLatest})`);

      const logger = pino({ level: 'silent' });

      // Instantiate socket
      const makeSocketFn = (makeWASocket as any).default || makeWASocket;
      this.sock = makeSocketFn({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: ['Dinar Indicator', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false
      });

      if (!this.sock) {
        throw new Error('Failed to create WhatsApp socket instance');
      }

      // Handle credentials update
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[WhatsApp] New QR code generated.');
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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[WhatsApp] Connection closed. Status code: ${statusCode}. Should reconnect: ${shouldReconnect}`);

          this.status = 'disconnected';
          this.qrCodeUrl = null;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WhatsApp] Logged out. Clearing credentials...');
            this.clearAuthFiles();
            this.phoneNumber = null;
            this.userName = null;
            this.connectedAt = null;
          } else if (shouldReconnect) {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(5000 * this.reconnectAttempts, 30000);
              console.log(`[WhatsApp] Reconnecting in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => {
                this.isInitializing = false;
                this.initClient().catch(console.error);
              }, delay);
            } else {
              this.lastError = 'فشل الاتصال المتكرر بواتساب. يرجى إعادة الربط.';
              this.status = 'error';
            }
          }
        } else if (connection === 'open') {
          console.log('[WhatsApp] Connection established successfully!');
          this.status = 'connected';
          this.qrCodeUrl = null;
          this.connectedAt = new Date().toISOString();
          this.lastError = null;
          this.reconnectAttempts = 0;

          if (this.sock?.user) {
            this.phoneNumber = this.sock.user.id ? this.sock.user.id.split(':')[0] : null;
            this.userName = this.sock.user.name || null;
            console.log(`[WhatsApp] Connected as: ${this.userName || 'Bot'} (${this.phoneNumber})`);
          }
        }
      });

      // Handle incoming messages
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

  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        console.log('[WhatsApp] Disconnecting socket...');
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (e) {
      console.warn('[WhatsApp] Error during socket logout:', e);
    } finally {
      this.clearAuthFiles();
      this.status = 'disconnected';
      this.qrCodeUrl = null;
      this.phoneNumber = null;
      this.userName = null;
      this.connectedAt = null;
      this.lastError = null;
      this.reconnectAttempts = 0;
      console.log('[WhatsApp] Disconnected and session cleared.');
    }
  }

  private clearAuthFiles(): void {
    if (fs.existsSync(AUTH_DIR)) {
      try {
        const files = fs.readdirSync(AUTH_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        }
      } catch (err) {
        console.error('[WhatsApp] Failed to clear auth files:', err);
      }
    }
  }
}

export const whatsappManager = new WhatsAppManager();
