import crypto from 'crypto'

function generateSecureToken() {
    return crypto.randomBytes(3).toString('hex'); // 34rt56
}

function isExpired (expireAt) {
    const now = new Date().getTime();
    return now > expireAt;
}

export { generateSecureToken, isExpired };