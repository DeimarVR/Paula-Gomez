type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} (${scope}) ${message}`;
  const args = meta === undefined ? [line] : [line, meta];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => emit('error', scope, message, meta),
    debug: (message: string, meta?: unknown) => {
      if (process.env.NODE_ENV !== 'production') emit('debug', scope, message, meta);
    },
  };
}
