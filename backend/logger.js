import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Crear la carpeta 'logs' si no existe
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Formato consistente para los logs (archivo y consola)
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
);

// Configuración de Winston
const logger = winston.createLogger({
    level: 'silly', // Nivel mínimo de logs registrados (puede ser 'info', 'warn', 'error', etc.)
    format: logFormat,
    transports: [
        // Registrar todos los logs de nivel 'info' y superior en info.log
        new winston.transports.File({
            filename: path.join(logsDir, 'info.log'),
            level: 'info',
        }),
        // Registrar todos los logs de nivel 'error' y superior en error.log
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
        }),
    ],
});

// Si estás en desarrollo, agrega un transporte para mostrar logs en la consola
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: logFormat,
        })
    );
}

export default logger;