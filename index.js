import { app, PORT } from './src/app.js'
import email from './src/routes/email.js'
import token from './src/routes/token.js'
import address from './src/routes/address.js'
import subscription from './src/routes/subscription.js'
import webhook from './src/routes/webhook.js'
import logger from './logger.js'

app.use('/email', email);
app.use('/token', token);
app.use('/address', address);
app.use('/subscription', subscription);
app.use('/webhook', webhook);

app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`)
})
