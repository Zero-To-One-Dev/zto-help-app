import { getExpiredDraftOrders, setDraftOrderStatus, deleteDraftOrder } from "../services/draft-orders.js";
import logger from "../../logger.js";

(async () => {
    const shopAlias = 'HS'
    const expiredDraftOrders = await getExpiredDraftOrders(shopAlias);
    for (const draftOrder of expiredDraftOrders) {
        try {
            await setDraftOrderStatus(draftOrder, 'PROCESSING');
            const [message, draftOrderId] = await deleteDraftOrder(draftOrder.shop_alias, draftOrder.draft_order);
            if (!message) {
                const success_message = `Draft order ${draftOrderId} deleted successfully from DB and from Shopify`;
                logger.info(success_message);
                await setDraftOrderStatus(draftOrder, 'COMPLETED', success_message, draftOrder.retries+1);
            } else throw Error(message);
        } catch (err) {
            await setDraftOrderStatus(draftOrder, 'ERROR', err.message, draftOrder.retries+1);
            logger.error(err.message);
        }
    }
})();