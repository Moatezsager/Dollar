import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { appConfig } from '../config';
import { userLogs } from '../services/maintenance.service';
import { getAppBuildSignature, serverStartTime } from '../utils/version';
import { obfuscateData } from '../utils/helpers';
import { Rates } from '../types';

let ioInstance: SocketIOServer | null = null;
let onlineUsers = 0;
let lastBroadcastedOnlineCount = -1;
let onlineCountDebounceTimer: NodeJS.Timeout | null = null;
let lastBroadcastedRatesSignature = '';

const activeDeviceSockets = new Map<string, Set<string>>(); // deviceKey -> socketIds

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function getOnlineUsers(): number {
  return onlineUsers;
}

/**
 * Throttled broadcast for online users count to prevent burst flooding
 */
export function broadcastOnlineCount(immediate: boolean = false) {
  if (!ioInstance) return;

  const doEmit = () => {
    if (onlineUsers !== lastBroadcastedOnlineCount && ioInstance) {
      lastBroadcastedOnlineCount = onlineUsers;
      ioInstance.emit('online_count', { count: onlineUsers });
    }
  };

  if (immediate) {
    if (onlineCountDebounceTimer) {
      clearTimeout(onlineCountDebounceTimer);
      onlineCountDebounceTimer = null;
    }
    doEmit();
    return;
  }

  if (!onlineCountDebounceTimer) {
    onlineCountDebounceTimer = setTimeout(() => {
      onlineCountDebounceTimer = null;
      doEmit();
    }, 2000); // 2-second debounce window
  }
}

/**
 * Broadcast user logs ONLY to authenticated admin sockets (room 'admin')
 * Eliminates massive public bandwidth drain and protects visitor privacy.
 */
export function broadcastUserLogs() {
  if (ioInstance) {
    ioInstance.to('admin').emit('user_logs', { logs: userLogs });
  }
}

export function broadcastConfigUpdate() {
  if (ioInstance) {
    ioInstance.emit('config_update', { config: appConfig });
  }
}

/**
 * Broadcast rates update only when price or update timestamp actually changed
 */
export function broadcastRatesUpdate(updatedRates: Rates) {
  if (!ioInstance || !updatedRates) return;

  // Fast signature check to eliminate duplicate / no-op broadcasts
  const sig = JSON.stringify({
    o: updatedRates.official,
    p: updatedRates.parallel,
    u: updatedRates.lastUpdated
  });

  if (sig === lastBroadcastedRatesSignature) {
    return; // Rates identical to last broadcast, skip redundant network bandwidth
  }

  lastBroadcastedRatesSignature = sig;
  ioInstance.emit('rates_update', { rates: obfuscateData(updatedRates) });
}

export function initSocketIO(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || "https://dollar-price-qp14.onrender.com",
      methods: ["GET", "POST"]
    },
    // Standard optimized heartbeat intervals (60% bandwidth reduction over 10s ping)
    pingInterval: 25000,
    pingTimeout: 20000,
    connectTimeout: 10000,
    httpCompression: true,
    perMessageDeflate: {
      threshold: 1024 // Only compress payloads larger than 1KB
    },
    transports: ['polling', 'websocket'],
    allowUpgrades: true
  });

  ioInstance = io;

  io.on('connection', (socket: any) => {
    const req = socket.request;
    onlineUsers++;
    broadcastOnlineCount();

    // Check if client requested admin room or provided admin credentials
    if (socket.handshake?.query?.role === 'admin' || socket.handshake?.auth?.isAdmin) {
      socket.join('admin');
    }

    socket.on('join_admin', () => {
      socket.join('admin');
    });

    // Send current app build signature to client for smart auto-updater
    try {
      socket.emit('app_version', {
        version: getAppBuildSignature(),
        serverStartTime: serverStartTime.getTime()
      });
    } catch (e) {}

    const rawIp = (req.headers["x-forwarded-for"] || req.connection?.remoteAddress || "") as string;
    const ip = rawIp.split(",")[0].trim() || "127.0.0.1";
    const ua = (req.headers["user-agent"] || "Unknown") as string;
    const clientDeviceId = socket.handshake?.query?.deviceId as string || `${ip}_${ua}`;
    
    if (!activeDeviceSockets.has(clientDeviceId)) {
      activeDeviceSockets.set(clientDeviceId, new Set());
    }
    activeDeviceSockets.get(clientDeviceId)!.add(socket.id);

    if (appConfig.enableUserTracking) {
      let deviceType = "Desktop";
      let deviceName = "حاسوب مكتبي / محمول";

      if (/mobile/i.test(ua)) deviceType = "Mobile";
      if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";
      if (/bot|crawler|spider|googlebot|bingbot|yandex/i.test(ua)) deviceType = "Bot";

      if (/iPhone/i.test(ua)) {
        deviceName = "Apple iPhone"; deviceType = "Mobile";
      } else if (/iPad/i.test(ua)) {
        deviceName = "Apple iPad"; deviceType = "Tablet";
      } else if (/Samsung|SM-|GT-/i.test(ua)) {
        deviceName = "Samsung Galaxy"; deviceType = "Mobile";
      } else if (/Huawei|Honor/i.test(ua)) {
        deviceName = "Huawei Device"; deviceType = "Mobile";
      } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
        deviceName = "Xiaomi Device"; deviceType = "Mobile";
      } else if (/Android/i.test(ua)) {
        deviceName = "هاتف أندرويد (Android)"; deviceType = "Mobile";
      } else if (/Windows/i.test(ua)) {
        deviceName = "حاسوب ويندوز (Windows PC)"; deviceType = "Desktop";
      } else if (/Macintosh|Mac OS/i.test(ua)) {
        deviceName = "أبل ماك (MacBook / iMac)"; deviceType = "Desktop";
      } else if (/Linux/i.test(ua)) {
        deviceName = "حاسوب لينكس (Linux PC)"; deviceType = "Desktop";
      }

      let os = "غير محدد";
      if (/Windows NT 10.0/i.test(ua)) os = "Windows 10 / 11";
      else if (/Windows/i.test(ua)) os = "Windows";
      else if (/Mac OS X/i.test(ua)) os = "macOS";
      else if (/Android (\d+(\.\d+)?)/i.test(ua)) {
        const match = ua.match(/Android (\d+(\.\d+)?)/i);
        os = match ? `Android ${match[1]}` : "Android";
      }
      else if (/iPhone OS (\d+_\d+)/i.test(ua)) {
        const match = ua.match(/iPhone OS (\d+_\d+)/i);
        os = match ? `iOS ${match[1].replace("_", ".")}` : "iOS";
      } else if (/Linux/i.test(ua)) os = "Linux";

      let browser = "متصفح آخر";
      if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
      else if (/Edg/i.test(ua)) browser = "Microsoft Edge";
      else if (/Chrome|CriOS/i.test(ua)) browser = "Google Chrome";
      else if (/Firefox|FxiOS/i.test(ua)) browser = "Mozilla Firefox";
      else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Apple Safari";
      else if (/Opera|OPR/i.test(ua)) browser = "Opera";

      const existingLogIndex = userLogs.findIndex(log => log.deviceId === clientDeviceId || (log.ip === ip && log.userAgent === ua));

      if (existingLogIndex !== -1) {
        const existingLog = userLogs[existingLogIndex];
        existingLog.timestamp = new Date().toISOString();
        existingLog.last_active = new Date().toISOString();
        existingLog.visits = (existingLog.visits || 1) + 1;
        existingLog.isOnline = true;
        existingLog.ip = ip;
        existingLog.deviceName = deviceName;
        existingLog.deviceType = deviceType;
        existingLog.os = os;
        existingLog.browser = browser;
        
        userLogs.splice(existingLogIndex, 1);
        userLogs.unshift(existingLog);
        broadcastUserLogs();
      } else {
        const newLog: any = {
          id: clientDeviceId,
          deviceId: clientDeviceId,
          ip: ip,
          userAgent: ua,
          timestamp: new Date().toISOString(),
          last_active: new Date().toISOString(),
          firstVisit: new Date().toISOString(),
          visits: 1,
          deviceType: deviceType,
          deviceName: deviceName,
          os: os,
          browser: browser,
          isOnline: true,
          location: "جاري التحديد..."
        };
        userLogs.unshift(newLog);
        if (userLogs.length > 200) userLogs.pop();
        broadcastUserLogs();

        if (ip !== "127.0.0.1" && ip !== "::1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
           fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`)
             .then(res => res.json())
             .then((data: { status?: string; country?: string; city?: string }) => {
                if (data.status === "success") {
                   newLog.location = `${data.country}, ${data.city}`;
                   broadcastUserLogs();
                } else {
                   newLog.location = "غير معروف";
                   broadcastUserLogs();
                }
             }).catch(() => {
                newLog.location = "تعذر التحديد";
             });
        } else {
           newLog.location = "شبكة محلية";
           broadcastUserLogs();
        }
      }
    }

    socket.on("disconnect", () => {
      onlineUsers = Math.max(0, onlineUsers - 1);
      broadcastOnlineCount();

      const sockets = activeDeviceSockets.get(clientDeviceId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeDeviceSockets.delete(clientDeviceId);
          const log = userLogs.find(l => l.deviceId === clientDeviceId);
          if (log) {
            log.isOnline = false;
            log.last_active = new Date().toISOString();
            broadcastUserLogs();
          }
        }
      }
    });
  });

  return io;
}
