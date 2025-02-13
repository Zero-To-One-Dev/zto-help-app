import * as winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Crear la carpeta 'logs' si no existe
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
);

const logger = winston.createLogger({
    level: 'silly',
    format: logFormat,
    transports: [
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'info.log.%DATE%'),
            datePattern: 'YYYY-MM-DD',
            createSymlink: true,
            dirname: logsDir,
            symlinkName: path.join(logsDir, 'info.log'),
            level: 'info',
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(logsDir, 'error.log.%DATE%'),
            datePattern: 'YYYY-MM-DD',
            createSymlink: true,
            dirname: logsDir,
            symlinkName: path.join(logsDir, 'error.log'),
            level: 'error',
        }),
    ],
});

logger.add(
    new winston.transports.Console({
        format: logFormat,
    })
);


export default logger;