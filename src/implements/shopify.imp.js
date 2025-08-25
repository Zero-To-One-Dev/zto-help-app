import app, { HOSTNAME } from "../app.js"
import "@shopify/shopify-api/adapters/node"
import { shopifyApi, Session, LogSeverity } from "@shopify/shopify-api"
import logger from "../../logger.js"

class ShopifyImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  init() {
    const {
      [`SHOPIFY_API_KEY_${this.shopAlias}`]: SHOPIFY_API_KEY,
      [`SHOPIFY_API_SECRET_KEY_${this.shopAlias}`]: SHOPIFY_API_SECRET_KEY,
      [`SHOPIFY_URL_${this.shopAlias}`]: SHOP_URL,
    } = app

    const shopify = shopifyApi({
      apiKey: SHOPIFY_API_KEY,
      apiSecretKey: SHOPIFY_API_KEY,
      scopes: ["write_draft_orders", "read_products"],
      hostName: HOSTNAME,
      hostScheme: "http",
      isEmbeddedApp: false,
      logger: {
        log: (severity, message) =>
          logger.log({
            level: LogSeverity[severity].toLowerCase(),
            message: message,
          }),
      },
    })

    const session = new Session({
      id: "",
      shop: SHOP_URL,
      accessToken: SHOPIFY_API_SECRET_KEY,
      state: "",
      isOnline: false,
    })

    return new shopify.clients.Graphql({ session })
  }

  async getOrderById(id) {
    const client = this.init()
    return (
      await client.request(`
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
    `)
    ).data.order
  }

  async getCustomerNameByEmail(email) {
    const client = this.init()
    const customerByIdentifier = (
      await client.request(`
      query {
        customerByIdentifier
      (identifier: { emailAddress: "${email}" }) {
          displayName
        }
      } 
    `)
    ).data.customerByIdentifier
    return customerByIdentifier ? customerByIdentifier.displayName : null
  }

  async getSubscription(email, subscription) {
    const client = this.init()
    return (
      (
        await client.request(`
      query {
        Subscriptions (limit: 1, where: {
            id: {_eq: '${subscription}'},	
            StorefrontUser: {email: {_eq: '${email}'}}
          }, ) {
            id
        }
      }
    `)
      ).Subscriptions.length > 0
    )
  }

  async cancelSubscription(subscription) {
    const client = this.init()
    return (
      await client.request(`
      mutation {
        cancelSubscription(input: {subscriptionId: '${subscription}', shouldSendNotif: true}) {
          ok
        }
      }
    `)
    ).cancelSubscription.ok
  }

  async createOrder(variables) {
    const client = this.init()
    const mutation = `
      mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order { id name }
          userErrors { field message }
        }
      }
    `

    let input = variables

    if (!variables) {
      input = {
        order: {
          lineItems: [
            {
              variantId: "gid://shopify/ProductVariant/50711345660183",
              quantity: 1,
            },
          ],
          email: "ejimenez@zerotoonegroup.com",
          shippingAddress: {
            firstName: "Erick",
            address1: "Paseo del paramo 169",
            phone: "+57 313 7421511",
            city: "SAN LUIS POTOSÍ",
            zip: "78421",
            province: "San Luis Potosí",
            country: "Mexico",
            lastName: "Jimenez",
            countryCode: "MX",
            provinceCode: "SLP",
          },
          billingAddress: {
            firstName: "Erick",
            address1: "Paseo del paramo 169",
            phone: "+57 313 7421511",
            city: "SAN LUIS POTOSÍ",
            zip: "78421",
            province: "San Luis Potosí",
            country: "Mexico",
            lastName: "Jimenez",
            countryCode: "MX",
            provinceCode: "SLP",
          },
          financialStatus: "PAID",
          note: "FAKE ORDER - QA via API",
          tags: ["app:zto:latam"],
          customAttributes: [
            { key: "UTM term", value: "LIPO+|+STATIC" },
            {
              key: "UTM content",
              value:
                "VSMX_VS+1.0_STATIC_LIPO+V4_DYNAMIC+CAPTION_JC_WEB+-+Copy+3",
            },
            {
              key: "UTM campaign",
              value:
                "VSMX+|+ABO+|+BROAD+|+CRTV+TEST+PHASE+|+08/15/25+|+WEB+|+OFFMAN+-+Copy",
            },
            { key: "UTM medium", value: "Instagram_Stories" },
            { key: "UTM source", value: "ig" },
            { key: "Country code", value: "MX" },
            { key: "Nombre", value: "Erick" },
            { key: "Apellido", value: "Gimenez" },
            { key: "Celular - WhatsApp", value: "5562292700" },
            { key: "Dirección Completa", value: "Paseo del paramo 169" },
            { key: "dropi_colonia", value: "Puerta natura" },
            {
              key: "Datos adicionales para mejorar tu entrega",
              value: "Benito juarez",
            },
            { key: "Estado", value: "SAN LUIS POTOSÍ" },
            { key: "Alcaldía/Municipio/Delegación", value: "SAN LUIS POTOSÍ" },
            { key: "Código postal", value: "78421" },
            { key: "Correo electrónico", value: "ejimenez@zerotoonegroup.com" },
            { key: "AceptaTyC", value: "on" },
            { key: "Newsletter", value: "off" },
            { key: "IP address", value: "189.203.104.59" },
          ],
          sourceName: "zto_help_app",
          transactions: [
            {
              kind: "SALE",
              gateway: "manual",
              amountSet: {
                shopMoney: { amount: "1498.00", currencyCode: "MXN" },
              },
              status: "SUCCESS",
            },
          ],
        },
        options: {
          sendReceipt: false,
          sendFulfillmentReceipt: false,
        },
      }
    }

    const res = await client.request(mutation, { variables })
    return res.data.orderCreate
  }

  async createDraftOrder(input) {
    const client = this.init()
    return (
      await client.request(
        `mutation draftOrderCreate($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
            }
          }
        }`,
        {
          variables: { input },
        }
      )
    ).data.draftOrderCreate.draftOrder.id
  }

  async getActiveOrders(email) {
    const client = this.init()
    return (
      await client.request(
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
        }`
      )
    ).data.orders.edges
  }

  async updateAddress(id, address1, address2, provinceCode, city, zip) {
    const client = this.init()
    return (
      await client.request(
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
      )
    ).data.orderUpdate
  }

  async subscriptionProductsIdsBySubscriptionVariant(variantsQuery) {
    const client = this.init()
    return (
      await client.request(`query {
        productVariants (first: 100, query: "${variantsQuery}") {
          edges {
            node {
              id
              title
              product {
                id
              }
            }
          }
        }
      }`)
    ).data.productVariants.edges
  }

  async oneTimesBySubscriptionMetafield(
    productSubscriptionMetafieldKey,
    productsSubQuery
  ) {
    const client = this.init()
    return (
      await client.request(`query {
        products(first: 100, query: "${productsSubQuery} AND status:ACTIVE") {
          edges {
            node {
              id
              metafields (first: 1, keys: "custom.${productSubscriptionMetafieldKey}") {
                edges {
                  node {
                    jsonValue
                  }
                }
              }
              variants (first: 200) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      }`)
    ).data.products.edges
  }

  async sendDraftOrderInvoice(draftOrder) {
    const client = this.init()
    return (
      await client.request(`mutation {
        draftOrderInvoiceSend (id: "${draftOrder}") {
          draftOrder {
            id
          }
        }
      }`)
    ).data.draftOrderInvoiceSend
  }

  async getDraftOrder(draftOrder) {
    const client = this.init()
    return (
      await client.request(`query {
        draftOrder (id: "${draftOrder}") {
          name
          status
        }
      }
    `)
    ).data.draftOrder
  }

  async deleteDraftOrder(draftOrder) {
    const client = this.init()
    return (
      await client.request(`mutation {
      draftOrderDelete (input: { id: "${draftOrder}" }) {
        deletedId
      }
    }`)
    ).data.draftOrderDelete.deletedId
  }

  async getLineItemsByOrder(orderId) {
    const client = this.init()
    return (
      await client.request(`query {
        order (id: "${orderId}") {
          lineItems (first: 100) {
            edges {
              node {
                quantity
                product {
                  id
                  productType
                }
                variant {
                  id
                  price
                  title
                }
              }
            }
          }
        }  
      }`)
    ).data.order.lineItems.edges
  }

  async createDiscountCode(input) {
    const client = this.init()
    return (
      await client.request(`mutation {
    	discountCodeBasicCreate (basicCodeDiscount: ${input}) {
        codeDiscountNode {
          id
        }
        userErrors {
          code
        }
      }
    }`)
    ).data.discountCodeBasicCreate.codeDiscountNode
  }
}

export default ShopifyImp
