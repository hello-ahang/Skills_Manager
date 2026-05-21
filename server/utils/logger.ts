import { pino } from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProd = process.env.NODE_ENV === 'production';

export const log = pino(
  isProd
    ? { level }
    : {
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
);

export type Logger = typeof log;
