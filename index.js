import { app, PORT } from './src/app.js'
import email from './src/routes/email.js'
import token from './src/routes/token.js'
import address from './src/routes/address.js'
import webhook from './src/routes/webhook.js'
import draftOrder from './src/routes/draft-order.js'
import subscriptions from './src/routes/subscriptions.js'
import testing from './src/routes/testing.js'
import logger from './logger.js'

app.use('/email', email);
app.use('/token', token);
app.use('/address', address);
app.use('/webhook', webhook);
app.use('/draft-order', draftOrder);
app.use('/subscriptions', subscriptions);
app.use('/testing', testing);

app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`)
})
