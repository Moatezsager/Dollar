export const logErrorToServer = async (error: Error | string | unknown, context?: string, arabicDescription?: string) => {
  try {
    let message = "Unknown error";
    let stack = "";

    if (error && typeof error === 'object') {
      const errName = (error as any).name;
      const errMsg = (error as any).message;
      if (errName === 'AbortError' || errName === 'TimeoutError' || (typeof errMsg === 'string' && errMsg.includes('signal timed out'))) {
        return; // Ignore network timeout errors to prevent log spam
      }
      if (error instanceof TypeError && errMsg === 'Failed to fetch') {
        return; // Ignore network connection errors to prevent log spam
      }
      if (typeof errMsg === 'string' && (errMsg.includes('WebSocket closed') || errMsg.includes('websocket') || errMsg.includes('vite'))) {
        return; // Ignore benign Vite HMR websocket closure in container sandbox
      }
    }

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack || "";
    } else if (typeof error === "string") {
      if (error.includes('AbortError') || error.includes('TimeoutError') || error.includes('signal timed out')) {
        return;
      }
      if (error.includes('WebSocket closed') || error.includes('websocket') || error.includes('vite')) {
        return;
      }
      message = error;
    } else {
      try {
        message = JSON.stringify(error);
      } catch (e) {
        message = "Error object could not be stringified: " + String(error);
      }
    }

    if (message.includes('WebSocket closed') || stack.includes('WebSocket closed') || (context && context.includes('vite'))) {
      return;
    }

    await fetch('/api/logs/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: arabicDescription || message,
        stack,
        context: context || 'General',
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    });
  } catch (e) {
    if (e instanceof TypeError && e.message === 'Failed to fetch') {
      // Silently ignore fetch errors for the logger to avoid console spam when offline
    } else {
      console.error('Failed to send error log to server', e);
    }
  }
};
