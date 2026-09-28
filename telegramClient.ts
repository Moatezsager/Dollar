import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { CustomFile } from "telegram/client/uploads";

/**
 * Public channel scraper that extracts live messages and timestamps directly from t.me/s/ preview.
 * Requires ZERO Telegram session, zero login, and is completely immune to AUTH_KEY_DUPLICATED.
 */
export async function fetchPublicChannelMessages(
  channelUsername: string,
  limit: number = 10
): Promise<{ text: string; date: number }[]> {
  try {
    let username = channelUsername.trim();
    if (username.includes('t.me/')) {
      username = username.split('t.me/')[1].split('/')[0].split('?')[0];
    }
    username = username.replace('@', '').replace('s/', '').trim();
    if (!username) return [];

    const url = `https://t.me/s/${username}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const timeRegex = /<time[^>]*datetime=\"([^\"]+)\"/;
    const textRegex = /<div class=\"tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/;

    const results: { text: string; date: number }[] = [];
    const parts = html.split('<div class=\"tgme_widget_message_wrap');

    for (let i = parts.length - 1; i >= 1; i--) {
      const part = parts[i];
      const timeMatch = part.match(timeRegex);
      const textMatch = part.match(textRegex);
      if (timeMatch && textMatch) {
        const timeIso = timeMatch[1];
        const text = textMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '\"')
          .trim();
        if (text) {
          results.push({
            text,
            date: new Date(timeIso).getTime()
          });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  } catch (e: any) {
    return [];
  }
}

export class TelegramManager {
  private client: TelegramClient | null = null;
  private apiId: number;
  private apiHash: string;
  private sessionString: string;
  public botToken?: string;
  private isConnecting = false;
  private connectPromise: Promise<TelegramClient | null> | null = null;
  private cooldownUntil = 0;
  public lastFetchTime: number = 0;
  public lastError: string = "";
  public isAuthRevoked = false;

  constructor(apiId: number, apiHash: string, sessionString: string, botToken?: string) {
    this.apiId = apiId;
    this.apiHash = apiHash;
    this.sessionString = sessionString;
    this.botToken = botToken;
  }

  public updateCredentials(apiId: number, apiHash: string, sessionString: string, botToken?: string) {
    if (this.apiId !== apiId || this.apiHash !== apiHash || this.sessionString !== sessionString || this.botToken !== botToken) {
      console.log("[TelegramManager] Credentials updated, resetting client state.");
      this.apiId = apiId;
      this.apiHash = apiHash;
      this.sessionString = sessionString;
      this.botToken = botToken;
      this.isAuthRevoked = false;
      this.lastError = "";
      if (this.client) {
        this.client.disconnect().catch(() => {});
        this.client = null;
        activeClient = null;
      }
      this.connectPromise = null;
      this.cooldownUntil = 0;
    }
  }

  /**
   * Gets or creates the Telegram client instance.
   * Implements connection stability and authorization checks.
   */
  public async getClient(): Promise<TelegramClient | null> {
    if (this.isAuthRevoked) {
      const now = Date.now();
      if (now < this.cooldownUntil) {
        return null;
      }
    }

    // If a connection attempt is already in flight, reuse its promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // If already connected and authorized, return it
    if (this.client && this.client.connected) {
      try {
        const isAuthorized = await this.client.checkAuthorization();
        if (isAuthorized) {
          activeClient = this.client;
          return this.client;
        }
      } catch (e) {
        console.warn("[TelegramManager] Authorization check failed, re-connecting...");
      }
    }

    // Cooldown check to prevent rapid reconnection loops
    const now = Date.now();
    if (now < this.cooldownUntil) {
      const remainingSec = Math.ceil((this.cooldownUntil - now) / 1000);
      console.warn(`[TelegramManager] In cooldown period (${remainingSec}s remaining), skipping connection attempt.`);
      return null;
    }

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async doConnect(): Promise<TelegramClient | null> {
    this.isConnecting = true;
    try {
      if (!this.sessionString) {
        this.lastError = "لم يتم حفظ جلسة تيليجرام بعد";
        return null;
      }

      console.log("[TelegramManager] Initializing new Telegram client...");
      
      if (this.client) {
        try { 
          await this.client.disconnect(); 
          if ((this.client as any).destroy) await (this.client as any).destroy();
        } catch (e) {}
      }

      const stringSession = new StringSession(this.sessionString || "");
      this.client = new TelegramClient(stringSession, this.apiId, this.apiHash, {
        connectionRetries: 2,
        useWSS: false,
        autoReconnect: true,
        floodSleepThreshold: 120,
        deviceModel: "PriceScraperServer",
        systemVersion: "1.0.0",
        appVersion: "1.0",
      });

      await this.client.connect();
      
      const isAuthorized = await this.client.checkAuthorization();
      if (!isAuthorized) {
        throw new Error("Session is not authorized. Please check your session string.");
      }
      
      console.log("[TelegramManager] Successfully connected and authorized.");
      this.isAuthRevoked = false;
      this.lastError = "";
      activeClient = this.client;
      return this.client;
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error("[TelegramManager] Connection failed:", errorMsg);
      
      let cooldownDuration = 30000;
      if (errorMsg.includes("AUTH_KEY_DUPLICATED")) {
        this.isAuthRevoked = true;
        this.lastError = "تم إبطال جلسة تيليجرام (AUTH_KEY_DUPLICATED) من سيرفرات تيليجرام بسبب تشغيلها في مكان آخر أو إعادة تشغيل التطبيق. يرجى تجديد تسجيل الدخول من لوحة التحكم أو استخدام Bot Token.";
        console.warn("[TelegramManager] AUTH_KEY_DUPLICATED: This Telegram session is invalidated on Telegram servers. Pausing reconnect attempts.");
        cooldownDuration = 5 * 60 * 1000; // 5 mins cooldown
      } else {
        this.lastError = errorMsg;
      }
      
      if (this.client) {
        try { 
          await this.client.disconnect(); 
          if ((this.client as any).destroy) await (this.client as any).destroy();
        } catch (e) {}
      }
      this.client = null;
      activeClient = null;
      this.cooldownUntil = Date.now() + cooldownDuration;
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Fetches messages from a channel with robust error handling and automatic public web preview fallback.
   */
  public async fetchMessages(channelUsername: string, limit: number = 10): Promise<{text: string, date: number}[]> {
    // 1. Try via GramJS MTProto client if connected
    const client = await this.getClient();
    if (client) {
      try {
        let username = channelUsername.trim();
        if (username.includes('t.me/')) {
          username = username.split('t.me/')[1].split('/')[0].split('?')[0];
        }
        username = username.replace('@', '').trim();
        let entity;
        
        try {
          entity = await client.getEntity(username);
        } catch (e) {
          const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
          if (resolved.chats && resolved.chats.length > 0) {
            entity = resolved.chats[0];
          } else if (resolved.users && resolved.users.length > 0) {
            entity = resolved.users[0];
          } else {
            entity = username;
          }
        }

        const messages = await client.getMessages(entity, { limit });
        this.lastFetchTime = Date.now();
        
        const valid = messages
          .filter((m) => m.message && m.message.trim() !== "")
          .map((m) => ({
            text: m.message || "",
            date: m.date ? m.date * 1000 : Date.now(),
          }));

        if (valid.length > 0) {
          return valid;
        }
      } catch (error: any) {
        console.warn(`[TelegramManager] GramJS fetch failed for ${channelUsername} (${error.message || error}), switching to public HTTP scraper...`);
        if (error.message?.includes('connection') || error.message?.includes('disconnected') || error.message?.includes('AUTH_KEY_DUPLICATED')) {
          this.client = null;
          activeClient = null;
        }
      }
    }

    // 2. Seamless fallback to public channel HTTP preview (zero auth required, always works)
    const publicMsgs = await fetchPublicChannelMessages(channelUsername, limit);
    if (publicMsgs.length > 0) {
      this.lastFetchTime = Date.now();
      return publicMsgs;
    }

    return [];
  }

  /**
   * Sends a message via Telegram Bot API (HTTP REST).
   * Fully immune to AUTH_KEY_DUPLICATED and MTProto connection drops.
   */
  public async sendViaBotApi(
    channelUsername: string, 
    message: string, 
    options?: { parseMode?: 'html' | 'md'; linkPreview?: boolean }
  ): Promise<boolean> {
    const token = (this.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) return false;

    let target = channelUsername.trim();
    if (target.includes('t.me/')) {
      target = target.split('t.me/')[1].split('/')[0].split('?')[0];
    }
    target = target.replace('@', '').trim();
    if (!target.startsWith('-100') && !target.startsWith('@')) {
      target = '@' + target;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: target,
          text: message,
          parse_mode: options?.parseMode === 'html' ? 'HTML' : 'Markdown',
          disable_web_page_preview: options?.linkPreview === false
        })
      });
      const data: any = await res.json();
      if (data.ok) {
        this.lastError = "";
        return true;
      }

      // If markdown formatting failed, fallback to clean plain text
      if (data.description && /parse|markdown|entity/i.test(data.description)) {
        const plain = message.replace(/[*_`]/g, '');
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: target,
            text: plain,
            disable_web_page_preview: options?.linkPreview === false
          })
        });
        const retryData: any = await retryRes.json();
        if (retryData.ok) {
          this.lastError = "";
          return true;
        }
        this.lastError = retryData.description || data.description;
        return false;
      }

      this.lastError = data.description || "فشل الإرسال عبر البوت";
      return false;
    } catch (e: any) {
      this.lastError = e.message || String(e);
      return false;
    }
  }

  /**
   * Sends a message to a channel via Bot API or MTProto.
   */
  public async sendMessage(
    channelUsername: string, 
    message: string, 
    options?: { parseMode?: 'html' | 'md'; linkPreview?: boolean }
  ): Promise<boolean> {
    // 1. If Telegram Bot Token is configured, prefer Bot API (100% stable, no AUTH_KEY_DUPLICATED)
    const botToken = (this.botToken || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (botToken) {
      const sent = await this.sendViaBotApi(channelUsername, message, options);
      if (sent) {
        console.log(`[TelegramManager] Successfully sent message via Telegram Bot API to ${channelUsername}`);
        return true;
      }
      console.warn(`[TelegramManager] Bot API send failed (${this.lastError}), attempting MTProto user account...`);
    }

    // 2. MTProto user account
    const client = await this.getClient();
    if (!client) {
      if (this.isAuthRevoked) {
        this.lastError = "تم إبطال جلسة تيليجرام (AUTH_KEY_DUPLICATED). يرجى إعادة تسجيل الدخول من لوحة التحكم لتوليد جلسة جديدة.";
      } else {
        this.lastError = this.lastError || "حساب تيليجرام غير متصل أو بانتظار الترخيص. يرجى التحقق من لوحة التحكم.";
      }
      console.error(`[TelegramManager] Cannot send message to ${channelUsername}: ${this.lastError}`);
      return false;
    }

    try {
      this.lastError = "";
      if (channelUsername === 'me') {
        try {
          await client.sendMessage('me', { 
            message,
            parseMode: options?.parseMode,
            linkPreview: options?.linkPreview ?? true
          });
          return true;
        } catch (meError: any) {
          if (options?.parseMode) {
            console.warn(`[TelegramManager] Sending with parseMode ${options.parseMode} failed (${meError.message}), falling back to plain text for 'me'...`);
            const plain = message.replace(/<[^>]+>/g, '');
            await client.sendMessage('me', { message: plain, linkPreview: options?.linkPreview ?? true });
            return true;
          }
          throw meError;
        }
      }

      let username = channelUsername.trim();
      if (username.includes('t.me/')) {
        username = username.split('t.me/')[1].split('/')[0].split('?')[0];
      }
      username = username.replace('@', '').trim();
      let entity: any = null;
      
      // Try to get entity from cache or resolve username
      try {
        entity = await client.getEntity(username);
      } catch (e) {
        console.log(`[TelegramManager] getEntity not in cache for ${username}, resolving via ResolveUsername...`);
        try {
          const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
          if (resolved.chats && resolved.chats.length > 0) {
            entity = resolved.chats[0];
          } else if (resolved.users && resolved.users.length > 0) {
            entity = resolved.users[0];
          } else {
            entity = username;
          }
        } catch (resolveErr: any) {
          console.warn(`[TelegramManager] ResolveUsername failed for ${username}:`, resolveErr.message || resolveErr);
          entity = username;
        }
      }

      try {
        await client.sendMessage(entity || username, { 
          message,
          parseMode: options?.parseMode,
          linkPreview: options?.linkPreview ?? true
        });
        console.log(`[TelegramManager] Successfully sent message to ${channelUsername}`);
        return true;
      } catch (sendErr: any) {
        // If it failed due to markdown formatting or entity parsing, retry as plain text
        if (options?.parseMode || /parse|entity|markdown|tag|unclosed/i.test(sendErr.message || '')) {
          console.warn(`[TelegramManager] Sending with parseMode failed (${sendErr.message}), falling back to plain text for ${channelUsername}...`);
          const plain = message.replace(/[*_`]/g, '');
          await client.sendMessage(entity || username, { 
            message: plain, 
            linkPreview: options?.linkPreview ?? true 
          });
          console.log(`[TelegramManager] Successfully sent message as plain text fallback to ${channelUsername}`);
          return true;
        }
        throw sendErr;
      }
    } catch (error: any) {
      this.lastError = error.message || String(error);
      console.error(`[TelegramManager] Error sending message to ${channelUsername}:`, this.lastError);
      if (error.message?.includes('connection') || error.message?.includes('disconnected') || error.message?.includes('AUTH_KEY_DUPLICATED')) {
        this.client = null;
        activeClient = null;
      }
      return false;
    }
  }

  /**
   * Sends a file/image to a Telegram channel or 'me' (Saved Messages).
   */
  public async sendFile(
    channelUsername: string,
    fileBuffer: Buffer,
    options?: { caption?: string; filename?: string; parseMode?: 'md' | 'html' }
  ): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      this.lastError = "تعذر الاتصال بحساب تيليجرام";
      return false;
    }

    try {
      this.lastError = "";
      let targetEntity: any = 'me';

      if (channelUsername && channelUsername !== 'me') {
        let username = channelUsername.trim();
        if (username.includes('t.me/')) {
          username = username.split('t.me/')[1].split('/')[0].split('?')[0];
        }
        username = username.replace('@', '').trim();
        try {
          targetEntity = await client.getEntity(username);
        } catch (e) {
          try {
            const resolved = await client.invoke(new Api.contacts.ResolveUsername({ username }));
            if (resolved.chats && resolved.chats.length > 0) {
              targetEntity = resolved.chats[0];
            } else if (resolved.users && resolved.users.length > 0) {
              targetEntity = resolved.users[0];
            } else {
              targetEntity = username;
            }
          } catch (resolveErr) {
            targetEntity = username;
          }
        }
      }

      const filename = options?.filename || 'weekly-harvest.png';
      const customFile = new CustomFile(filename, fileBuffer.length, '', fileBuffer);

      await client.sendFile(targetEntity, {
        file: customFile,
        caption: options?.caption || '',
        parseMode: options?.parseMode || 'md',
      });

      console.log(`[TelegramManager] Successfully sent file to ${channelUsername}`);
      return true;
    } catch (error: any) {
      this.lastError = error.message || String(error);
      console.error(`[TelegramManager] Error sending file to ${channelUsername}:`, this.lastError);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
        console.log("[TelegramManager] Disconnected successfully.");
      } catch (e) {}
      this.client = null;
      activeClient = null;
    }
  }

  public isConnected(): boolean {
    return !!(this.client && this.client.connected);
  }
}

// Singleton and helper exports
export let activeClient: TelegramClient | null = null;
let managerInstance: TelegramManager | null = null;

/**
 * Gets the singleton TelegramManager instance.
 */
export const getTelegramManager = (
  apiId: number,
  apiHash: string,
  sessionString: string,
  botToken?: string
): TelegramManager => {
  if (!managerInstance) {
    managerInstance = new TelegramManager(apiId, apiHash, sessionString, botToken);
  } else {
    // Update credentials if they changed
    managerInstance.updateCredentials(apiId, apiHash, sessionString, botToken);
  }
  return managerInstance;
};

/**
 * Gets a Telegram client using provided credentials.
 * Reuses existing manager if credentials match.
 */
export const getTelegramClient = async (
  apiId: number,
  apiHash: string,
  sessionString: string
): Promise<TelegramClient | null> => {
  const manager = getTelegramManager(apiId, apiHash, sessionString);
  return await manager.getClient();
};

/**
 * Initializes Telegram using environment variables.
 */
export const initializeTelegram = async (): Promise<TelegramClient | null> => {
  const apiId = Number(process.env.TELEGRAM_API_ID || process.env.VITE_TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH || process.env.VITE_TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION || process.env.TG_SESSION_V2 || process.env.VITE_TELEGRAM_SESSION;

  if (!apiId || !apiHash || !sessionString) {
    console.warn("[Telegram] Missing environment variables for initialization.");
    return null;
  }

  return await getTelegramClient(apiId, apiHash, sessionString);
};

/**
 * Helper to fetch messages from a channel.
 */
export const fetchChannelMessages = async (
  client: TelegramClient,
  channelUsername: string,
  limit: number = 10
): Promise<{text: string, date: number}[]> => {
  // We can't easily use the manager here if we only have the client,
  // but we can implement the logic directly.
  try {
    const username = channelUsername.replace('@', '').trim();
    const messages = await client.getMessages(username, { limit });
    return messages
      .filter((m) => m.message && m.message.trim() !== "")
      .map((m) => ({
        text: m.message || "",
        date: m.date ? m.date * 1000 : Date.now(),
      }));
  } catch (error) {
    console.error(`[Telegram] Error in fetchChannelMessages for ${channelUsername}:`, error);
    return [];
  }
};
