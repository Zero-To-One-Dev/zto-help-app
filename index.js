import { app, PORT } from './src/app.js'
import email from './src/routes/email.js'
import token from './src/routes/token.js'
import subscription from './src/routes/subscription.js'
import address from './src/routes/address.js'
import logger from './logger.js'

app.use('/email', email);
app.use('/token', token);
app.use('/subscription', subscription);
app.use('/address', address);

app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`)
})