import { sha512 } from "js-sha512"
import DBRepository from "../repositories/postgres.repository.js"
import logger from "../../logger.js"

const dbRepository = new DBRepository()

export const authenticateToken = async (req, res, next) => {
  const token = req.token
  const { nameApp } = req.body
  logger.info(`Name App: ${nameApp}`)
  if (!token || !nameApp)
    return res.status(401).json({ error: "Token or app name not provided" })
  try {
    const hashedApiToken = sha512(token)
    const result = await dbRepository.validateApiToken(hashedApiToken, nameApp)
    if (!result) return res.status(403).json({ error: "Invalid Token" })
    next()
  } catch (error) {
    console.error("Authentication error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}
