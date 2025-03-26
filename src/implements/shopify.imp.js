import app, { HOSTNAME } from '../app.js';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, Session, LogSeverity } from '@shopify/shopify-api';
import logger from '../../logger.js';

class ShopifyImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  init() {
    const {
      [`SHOPIFY_API_KEY_${this.shopAlias}`]: SHOPIFY_API_KEY,
      [`SHOPIFY_API_SECRET_KEY_${this.shopAlias}`]: SHOPIFY_API_SECRET_KEY,
      [`SHOPIFY_URL_${this.shopAlias}`]: SHOP_URL
    } = app;

    const shopify = shopifyApi({
      apiKey: SHOPIFY_API_KEY,
      apiSecretKey: SHOPIFY_API_KEY,
      scopes: ['write_draft_orders', 'read_products'],
      hostName: HOSTNAME,
      hostScheme: 'http',
      isEmbeddedApp: false,
      logger: {
        log: (severity, message) => logger.log({ level: LogSeverity[severity].toLowerCase(), message: message })
      }
    });

    const session = new Session({
      id: '',
      shop: SHOP_URL,
      accessToken: SHOPIFY_API_SECRET_KEY,
      state: '',
      isOnline: false,
    });

    return new shopify.clients.Graphql({ session });
  }

  async getOrderById(id) {
    const client = this.init()
    return (await client.request(`
      query {
        order (id: "${id}") {
          id
          name
          displayFinancialStatus
          shippingAddress {
            address1
            address2
            city
            provinceCode
            province
            country
            zip
            name
          }
        }
      }  
    `)).data.order
  }

  async getCustomerNameByEmail(email) {
    const client = this.init()
    const customerByIdentifier = (await client.request(`
      query {
        customerByIdentifier
      (identifier: { emailAddress: "${email}" }) {
          displayName
        }
      } 
    `)).data.customerByIdentifier
    return customerByIdentifier ? customerByIdentifier.displayName : null
  }

  async getSubscription(email, subscription) {
    const client = this.init()
    return (await client.request(`
      query {
        Subscriptions (limit: 1, where: {
            id: {_eq: '${subscription}'},	
            StorefrontUser: {email: {_eq: '${email}'}}
          }, ) {
            id
        }
      }
    `)).Subscriptions.length > 0
  }

  async cancelSubscription(subscription) {
    const client = this.init()
    return (await client.request(`
      mutation {
        cancelSubscription(input: {subscriptionId: '${subscription}', shouldSendNotif: true}) {
          ok
        }
      }
    `)).cancelSubscription.ok
  }

  async createDraftOrder(input) {
    const client = this.init();
    return (await client.request(
      `mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
            }
          }
        }`, {
      variables: { input }
    })).data.draftOrderCreate.draftOrder.id;
  }

  async getActiveOrders(email) {
    const client = this.init();
    return (await client.request(
      `query {
          orders(first: 100, reverse: true, query: "fulfillment_status:unfulfilled AND email:${email}") {
            edges {
              node {
                id
                name
                displayFinancialStatus
                shippingAddress {
                  address1
                  address2
                  city
                  provinceCode
                  province
                  countryCodeV2
                  zip
                }
                lineItems (first: 10) {
                  edges {
                    node {
                      image {
                        url
                      }
                      name
                      quantity
                      originalTotalSet {
                        shopMoney {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`)).data.orders.edges
  }

  async updateAddress(id, address1, address2, provinceCode, city, zip) {
    const client = this.init();
    return (await client.request(
      `mutation {
        orderUpdate(input: {id: "${id}", shippingAddress: {address1: "${address1}",
        address2: ${address2 ? `"${address2}"` : null}, city: "${city}",
        provinceCode: "${provinceCode}", zip: "${zip}"}}) {
          order {
            id
          }
          userErrors {
            message
            field
          }
        }
      }`

    )).data.orderUpdate
  }

  async productsIdsByVariant(variantsQuery) {
    const client = this.init();
    return (await client.request(`query {
        products (first: 100, query: "${variantsQuery}") {
          edges {
            node {
              id
              variants (first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }`)).data.products.edges
  }

  async oneTimesBySubscriptions(productSubscriptionMetafieldKey, productsSubQuery) {
    const client = this.init();
    return (await client.request(`query {
        products(first: 100, query: "${productsSubQuery}") {
          edges {
            node {
              id
              metafields (first: 1, keys: "custom.${productSubscriptionMetafieldKey}") {
                edges {
                  node {
                    jsonValue
                    reference {
                      ... on Product {
                        variants (first: 1) {
                          edges {
                            node {
                              price
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              variants (first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }`)).data.products.edges
  }

  async sendDraftOrderInvoice(draftOrder) {
    const client = this.init();
    return (await client.request(`mutation {
        draftOrderInvoiceSend (id: "${draftOrder}") {
          draftOrder {
            id
          }
        }
      }`)).data.draftOrderInvoiceSend
  }

  async getDraftOrder(draftOrder){
    const client = this.init();
    return (await client.request(`query {
        draftOrder (id: "${draftOrder}") {
          name
          status
        }
      }
    `)).data.draftOrder
  }

  async deleteDraftOrder(draftOrder) {
    const client = this.init();
    return (await client.request(`mutation {
      draftOrderDelete (input: { id: "${draftOrder}" }) {
        deletedId
      }
    }`)).data.draftOrderDelete.deletedId
  }
}

export default ShopifyImp;