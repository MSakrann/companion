import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export function getLogger(name?: string): pino.Logger {
  return pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: name ? { name } : undefined,
    // Structured JSON logging for Cloud Run / production
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

const rootLogger = getLogger('pov-companion');

export default rootLogger;
