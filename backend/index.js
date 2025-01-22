import { app, PORT } from './src/app.js'
import email from './src/routes/email.js'
import token from './src/routes/token.js'
import logger from './logger.js'

app.use('/email', email);
app.use('/token', token);

app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`)
})