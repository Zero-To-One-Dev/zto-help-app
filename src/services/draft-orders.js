import logger from '../../logger.js';
import DBRepository from '../repositories/postgres.repository.js';
import ShopifyImp from '../implements/shopify.imp.js';


const dbRepository = new DBRepository();


/**
 * Delete draft order first from shopify then from own database
 * @param {*} shopAlias 
 * @param {*} draftOrder example: gid://shopify/DraftOrder/1197633405209
 * @param {*} onlyDB
 * @returns shopify deletedId
 */
async function deleteDraftOrder(shopAlias, draftOrder) {
    try {
        let message, deletedId = '';
        const shopifyImp = new ShopifyImp(shopAlias);
        const draftOrderExists = await shopifyImp.getDraftOrder(draftOrder);
        if (draftOrderExists && draftOrderExists.status !== 'COMPLETED') deletedId = await shopifyImp.deleteDraftOrder(draftOrder);
        if (draftOrderExists && !deletedId) {
            message += `Draft order ${draftOrder} NOT deleted from Shopify`;
            return [message, null];
        }
        const deletedDB = await dbRepository.deleteDraftOrder(shopAlias, draftOrder)
        if (!deletedDB) message += `Draft order ${draftOrder} NOT deleted from DB`;
        return [message, deletedId];
    } catch (err) {
        console.log(err);
        logger.error(err.message);
        return [err.message, null]
    }
} 


/**
 * Get expired draft orders
 * @returns 
 */
async function getExpiredDraftOrders(shopAlias) { return await dbRepository.getExpiredDraftOrders(shopAlias) };


/**
 * Set draft order status, message and retries
 * @param {*} draftOrder 
 * @param {*} status 
 * @param {*} message 
 * @param {*} retries 
 */
async function setDraftOrderStatus(draftOrder, status, message=null, retries=null) {
    await dbRepository.setDraftOrderStatus(draftOrder, status, message, retries)
}


/**
 * Get active draft order from database sorted by payment due
 * @param {*} shopAlias 
 * @param {*} subscription 
 * @returns 
 */
async function getActiveDraftOrder(shopAlias, subscription) {
    try {
        const draftOrder = await dbRepository.getLastDraftOrderBySubscription(shopAlias, subscription);
    
        if (!draftOrder) return null;
        if (draftOrder.payment_due < new Date()) {
            await deleteDraftOrder(shopAlias, draftOrder.draft_order);
            return null;
        }
    
        return draftOrder;
    } catch (err) {
        console.log(err);
        logger.error(err.message);
    }
}


export { deleteDraftOrder, getExpiredDraftOrders, setDraftOrderStatus, getActiveDraftOrder };
