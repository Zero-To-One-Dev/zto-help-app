import crypto from 'crypto'
import logger from '../../logger.js'


function validateToken(email, token) {
    // Se debe consultar la base de datos 
}

function generateSecureToken() {
    return crypto.randomBytes(3).toString('hex'); // 34rt56
}

export { generateSecureToken, validateToken };