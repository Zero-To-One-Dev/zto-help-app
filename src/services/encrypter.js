import crypto from 'crypto';
import { ENCRYPTION_SECRET_KEY, ENCRYPTION_SECRET_IV, ENCRYPTION_METHOD } from '../app.js';

export default class Encrypter {
  constructor() {
    this.secretKey = crypto
      .createHash('sha512')
      .update(ENCRYPTION_SECRET_KEY)
      .digest('hex')
      .substring(0, 32)
    this.secretIV = crypto
      .createHash('sha512')
      .update(ENCRYPTION_SECRET_IV)
      .digest('hex')
      .substring(0, 16)
    this.encryptionMethod = ENCRYPTION_METHOD
  }

  // Encrypt data
  encryptData(data) {
    const cipher = crypto.createCipheriv(this.encryptionMethod, this.secretKey, this.secretIV)
    return Buffer.from(
      cipher.update(data, 'utf8', 'hex') + cipher.final('hex')
    ).toString('base64') // Encrypts data and converts to hex and base64
  }

  // Decrypt data
  decryptData(encryptedData) {
    const buff = Buffer.from(encryptedData, 'base64')
    const decipher = crypto.createDecipheriv(this.encryptionMethod, this.secretKey, this.secretIV)
    return (
      decipher.update(buff.toString('utf8'), 'hex', 'utf8') +
      decipher.final('utf8')
    ) // Decrypts data and converts to utf8
  }
}