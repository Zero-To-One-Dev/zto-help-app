import app, { HOSTNAME } from '../app.js';
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, Session, LogSeverity } from '@shopify/shopify-api';
import logger from '../../logger.js';

class ShopifyImp {
  constructor(shop, shopAlias) {
    this.shop = shop
    this.shopAlias = shopAlias
  }

  init() {
    const {
      [`SHOPIFY_API_KEY_${this.shopAlias}`]: SHOPIFY_API_KEY,
      [`SHOPIFY_API_SECRET_KEY_${this.shopAlias}`]: SHOPIFY_API_SECRET_KEY
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
      shop: this.shop,
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
    return await client.request(
      `mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
            }
          }
        }`, {
      variables: { input }
    });
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

  async productIdByVariant(variantId) {
    const client = this.init();
    return (await client.request(`query {
        products (first: 1, query: "variant_id:${variantId}") {
          edges {
            node {
              id
            }
          }
        }
      }`)).data.products.edges[0].node.id
  }

  async oneTimeBySubscription(subscriptionId) {
    const client = this.init();
    return (await client.request(`query {
        products(first: 1, query: "metafields.custom.product-subscription:\\"${subscriptionId}\\"") {
          edges {
            node {
              id
              title
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
      }`)).data.products.edges[0].node.variants.edges[0].node
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
}

export default ShopifyImp;