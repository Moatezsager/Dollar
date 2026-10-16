import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { appConfig } from '../config';
import { userLogs } from '../services/maintenance.service';
import { getAppBuildSignature, serverStartTime } from '../utils/version';
import { obfuscateData } from '../utils/helpers';
import { DeviceLogEntry, Rates } from '../types';
import { describeVisitor, locateVisitor, visitorIp } from '../services/visitor-details.service';
import { rates } from '../state';
import { isAdminTokenValid } from '../middleware/auth';
import { queueRatePush } from '../services/push.service';

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
    removeExpiredAdminSockets();
    ioInstance.to('admin').emit('user_logs', { logs: userLogs });
  }
}

export function broadcastConfigUpdate() {
  if (ioInstance) {
    removeExpiredAdminSockets();
    ioInstance.except('admin').emit('config_update', { config: { terms: appConfig.terms } });
    ioInstance.to('admin').emit('config_update', { config: appConfig });
  }
}

function removeExpiredAdminSockets() {
  for (const id of ioInstance?.sockets.adapter.rooms.get('admin') || []) {
    const socket = ioInstance?.sockets.sockets.get(id);
    if (socket && !isAdminTokenValid(socket.handshake.auth?.token)) {
      socket.leave('admin');
      socket.emit('admin_auth_error');
    }
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
  queueRatePush(updatedRates);
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

  io.use((socket, next) => {
    if (socket.handshake.auth?.token && !isAdminTokenValid(socket.handshake.auth.token)) {
      return next(new Error('ADMIN_UNAUTHORIZED'));
    }
    next();
  });

  io.on('connection', (socket: any) => {
    const req = socket.request;
    onlineUsers++;
    broadcastOnlineCount();

    if (isAdminTokenValid(socket.handshake.auth?.token)) {
      socket.join('admin');
    }

    socket.on('join_admin', () => {
      if (isAdminTokenValid(socket.handshake.auth?.token)) socket.join('admin');
    });

    // Send current app build signature to client for smart auto-updater
    try {
      socket.emit('app_version', {
        version: getAppBuildSignature(),
        serverStartTime: serverStartTime.getTime()
      });
    } catch (e) {}

    // Immediately push latest rates over socket for sub-second real-time render
    try {
      if (rates && rates.lastUpdated) {
        socket.emit('rates_update', { rates: obfuscateData(rates) });
      }
    } catch (e) {}

    const ip = visitorIp(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);
    const suppliedId = socket.handshake?.query?.deviceId;
    const clientDeviceId = typeof suppliedId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(suppliedId) ? suppliedId : socket.id;
    const trackingAllowed = () => appConfig.enableUserTracking && socket.handshake.auth?.tracking !== false &&
      req.headers.dnt !== '1' && req.headers['sec-gpc'] !== '1' && !isAdminTokenValid(socket.handshake.auth?.token);
    
    if (!activeDeviceSockets.has(clientDeviceId)) {
      activeDeviceSockets.set(clientDeviceId, new Set());
    }
    activeDeviceSockets.get(clientDeviceId)!.add(socket.id);

    if (trackingAllowed()) {
      const details = describeVisitor(ua);
      const existingLogIndex = userLogs.findIndex(log => log.deviceId === clientDeviceId);
      let visitorLog: DeviceLogEntry;

      if (existingLogIndex !== -1) {
        const existingLog = userLogs[existingLogIndex];
        visitorLog = existingLog;
        existingLog.timestamp = new Date().toISOString();
        existingLog.last_active = new Date().toISOString();
        existingLog.visits = (existingLog.visits || 1) + 1;
        existingLog.isOnline = true;
        existingLog.ip = ip;
        existingLog.userAgent = ua;
        Object.assign(existingLog, details);
        existingLog.modelSource = undefined;
        
        userLogs.splice(existingLogIndex, 1);
        userLogs.unshift(existingLog);
      } else {
        const newLog: DeviceLogEntry = {
          id: clientDeviceId,
          deviceId: clientDeviceId,
          ip: ip,
          userAgent: ua,
          timestamp: new Date().toISOString(),
          last_active: new Date().toISOString(),
          firstVisit: new Date().toISOString(),
          visits: 1,
          ...details,
          isOnline: true,
          location: "جاري التحديد..."
        };
        visitorLog = newLog;
        userLogs.unshift(newLog);
        if (userLogs.length > 200) userLogs.pop();
      }
      visitorLog.location = details.deviceType === 'Bot' ? 'غير متاح' : 'جاري التحديد...';
      visitorLog.locationStatus = details.deviceType === 'Bot' ? 'unavailable' : 'pending';
      broadcastUserLogs();
      if (details.deviceType !== 'Bot') {
        void locateVisitor(ip).then(location => {
          if (!trackingAllowed() || !userLogs.includes(visitorLog) || visitorLog.ip !== ip) return;
          Object.assign(visitorLog, location);
          broadcastUserLogs();
        });
      }
      if (details.os.startsWith('Android') && details.deviceType !== 'Bot') {
        socket.once('visitor_device', (data: unknown) => {
          if (!trackingAllowed() || !userLogs.includes(visitorLog) || visitorLog.userAgent !== ua) return;
          const model = (data as { model?: unknown })?.model;
          if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9 ._()+-]{1,79}$/.test(model) || model === 'Unknown') return;
          visitorLog.deviceModel = model.trim();
          visitorLog.deviceName = model.trim();
          visitorLog.modelSource = 'browser';
          broadcastUserLogs();
        });
        socket.emit('visitor_details_request');
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
