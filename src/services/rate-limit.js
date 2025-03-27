import logger from '../../logger.js';
import { SHOPS_ORIGIN } from '../app.js';
import MessageImp from '../implements/slack.imp.js'


const messageImp = new MessageImp();


export async function rateLimitHandler(req, res) {
  const route = req.originalUrl;
  const shopAlias = SHOPS_ORIGIN[req.get('origin')].shopAlias || req.body.shopAlias;
  const ip =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress || '';

  const errorShop = `🏪 SHOP: ${shopAlias}\\n`;
  let errorData = `ℹ️ DATA.\\n`;
  for (const [key, value] of Object.entries(req.body)) {
    errorData += `ℹ️ ${key.toUpperCase()}: ${value}\\n`;
  }
  errorData += `ℹ️ IP: ${ip}\\n`;
  const errorDescription = `📝 DESCRIPTION: Rate limit reached\\n`;
  const errorRoute = `📌 ROUTE: ${route}`;
  const errorFullMessage = `${errorShop}${errorData}${errorDescription}${errorRoute}`;
  const errorTitle = "🔴 ❌ ERROR: Rate limit reached";

  if (route.includes('subscription') || route.includes('draft-order')) messageImp.toCancelSubscriptionErrors(errorFullMessage, errorTitle);
  else messageImp.toUpdateAddressErrors(errorFullMessage, errorTitle);
  res.status(500).json({ message: 'Rate limit reached, please retry later' });
}