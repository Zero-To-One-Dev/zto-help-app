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
      scopes: ["write_draft_orders", "read_products", "write_orders"],
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

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }
  chunk(arr, size) {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
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

    const res = await client.request(mutation, { variables })
    return res.data.orderCreate
  }

  async updateOrder(input) {
    const client = this.init()
    const mutation = `
    mutation OrderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          name
          note
          tags
          customAttributes { key value }
          shippingAddress { address1 address2 city province zip country phone }
          poNumber
          localizedFields(first: 10) {
            nodes { key value countryCode purpose }
          }
          metafields(first: 10) {
            nodes { namespace key value type }
          }
        }
        userErrors { field message }
      }
    }
    `

    const variables = { input }
    const res = await client.request(mutation, { variables })
    const payload = res.data?.orderUpdate

    if (!payload) {
      throw new Error("orderUpdate sin payload de respuesta")
    }
    if (payload.userErrors && payload.userErrors.length) {
      // Propaga errores legibles
      const details = payload.userErrors
        .map((e) => `${e.field?.join(".") || "general"}: ${e.message}`)
        .join(" | ")
      throw new Error(`Shopify userErrors: ${details}`)
    }
    return payload.order
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

  async getDiscountCode(id) {
    const client = this.init()
    const query = `
      query {
        codeDiscountNode(id: "gid://shopify/DiscountCodeNode/${id}") {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              summary
              appliesOncePerCustomer
              asyncUsageCount
              usageLimit
              codes(first: 50) {
                nodes {
                  code
                  id
                }
              }
            }
          }
        }
      }
    `
    const res = await client.request(query)
    return res.data.codeDiscountNode?.codeDiscount
  }

  async getDiscountWithAllCodes(id) {
    const client = this.init()

    if (!id) throw new Error("Falta id del descuento")
    const gid = String(id).startsWith("gid://")
      ? String(id)
      : `gid://shopify/DiscountCodeNode/${id}`

    const PAGE_SIZE = 250
    let after = null
    const allCodes = []
    let meta = null

    while (true) {
      const afterArg = after ? `, after: "${after}"` : ""
      const query = `
      {
        codeDiscountNode(id: "${gid}") {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              title
              summary
              appliesOncePerCustomer
              asyncUsageCount
              usageLimit
              codes(first: ${PAGE_SIZE}${afterArg}) {
                pageInfo { hasNextPage endCursor }
                nodes { id code }
              }
            }
            ... on DiscountCodeBxgy {
              title
              summary
              codes(first: ${PAGE_SIZE}${afterArg}) {
                pageInfo { hasNextPage endCursor }
                nodes { id code }
              }
            }
            ... on DiscountCodeFreeShipping {
              title
              summary
              codes(first: ${PAGE_SIZE}${afterArg}) {
                pageInfo { hasNextPage endCursor }
                nodes { id code }
              }
            }
          }
        }
      }
    `

      const res = await client.request(query)
      const node = res?.data?.codeDiscountNode
      const discount = node?.codeDiscount
      if (!discount) {
        throw new Error(
          `No se encontró DiscountCodeNode con id=${gid}. Verifica que sea un id de DiscountCodeNode.`
        )
      }

      if (!meta) {
        meta = {
          typename: discount.__typename,
          title: discount.title,
          summary: discount.summary ?? null,
          appliesOncePerCustomer: discount.appliesOncePerCustomer ?? null,
          asyncUsageCount: discount.asyncUsageCount ?? null,
          usageLimit: discount.usageLimit ?? null,
        }
      }

      const page = discount.codes
      allCodes.push(...page.nodes.map((n) => ({ id: n.id, code: n.code })))

      if (!page.pageInfo.hasNextPage) break
      after = page.pageInfo.endCursor
    }

    return { ...meta, codes: allCodes }
  }

  get CREATE_BASIC() {
    return `
      mutation CreateBasic($input: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $input) {
          codeDiscountNode { id }
          userErrors { field code message }
        }
      }
    `
  }
  get CREATE_BXGY() {
    return `
      mutation CreateBxgy($input: DiscountCodeBxgyInput!) {
        discountCodeBxgyCreate(bxgyCodeDiscount: $input) {
          codeDiscountNode { id }
          userErrors { field code message }
        }
      }
    `
  }
  get CREATE_FREESHIP() {
    return `
      mutation CreateFreeShipping($input: DiscountCodeFreeShippingInput!) {
        discountCodeFreeShippingCreate(freeShippingCodeDiscount: $input) {
          codeDiscountNode { id }
          userErrors { field code message }
        }
      }
    `
  }
  get BULK_ADD_CODES() {
    return `
      mutation BulkAdd($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
        discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
          bulkCreation { id }
          userErrors { field code message }
        }
      }
    `
  }
  get BULK_STATUS() {
    return `
      query BulkStatus($id: ID!) {
        discountRedeemCodeBulkCreation(id: $id) {
          id
          done
          codesCount
          importedCount
          failedCount
        }
      }
    `
  }

  // Espera a que termine un job de carga de códigos
  async waitBulk(
    bulkId,
    { intervalMs = 1000, timeoutMs = 10 * 60 * 1000 } = {}
  ) {
    const client = this.init()
    const started = Date.now()
    while (true) {
      const { data, errors } = await client.request(this.BULK_STATUS, {
        id: bulkId,
      })
      if (errors?.length)
        throw new Error(errors.map((e) => e.message).join("; "))
      const st = data?.discountRedeemCodeBulkCreation
      if (!st) throw new Error("No se encontró el estado del bulk creation")
      if (st.done) return st
      if (Date.now() - started > timeoutMs)
        throw new Error("Timeout esperando el bulk creation")
      await this.sleep(intervalMs)
    }
  }

  // Crea el descuento en la tienda destino y agrega TODOS los códigos
  /**
   * @param {Object} params
   * @param {'DiscountCodeBasic'|'DiscountCodeBxgy'|'DiscountCodeFreeShipping'} params.type
   * @param {Object} params.input  // Input EXACTO del tipo (DiscountCodeBasicInput | DiscountCodeBxgyInput | DiscountCodeFreeShippingInput)
   * @param {Array<string|{code:string}>} params.codes // Todos los códigos a crear (1..10k)
   * @returns {Promise<{id:string, created:number, failed:number, batches:number}>}
   *
   * Nota: el input DEBE incluir toda la configuración del descuento (customerGets/items/segmentos/fechas/etc).
   * El primer código se usa para crear el descuento; los demás se agregan por lotes de 250.
   */
  async createDiscountWithCodes({ type, input, codes }) {
    if (!type) throw new Error("Falta type")
    if (!input) throw new Error("Falta input del descuento")
    if (!codes?.length) throw new Error("Debes pasar al menos un código")

    // Normaliza array de códigos
    const normalized = codes
      .map((c) => (typeof c === "string" ? c : c.code))
      .filter(Boolean)

    // Usa el primer código para la creación
    const firstCode = input.code ?? normalized[0]
    if (!firstCode)
      throw new Error("No hay código inicial para crear el descuento")
    const rest = input.code ? normalized : normalized.slice(1)

    // Ensambla la mutation correcta
    const client = this.init()
    const byType = {
      DiscountCodeBasic: {
        m: this.CREATE_BASIC,
        key: "discountCodeBasicCreate",
      },
      DiscountCodeBxgy: { m: this.CREATE_BXGY, key: "discountCodeBxgyCreate" },
      DiscountCodeFreeShipping: {
        m: this.CREATE_FREESHIP,
        key: "discountCodeFreeShippingCreate",
      },
    }
    const meta = byType[type]
    if (!meta) throw new Error(`Tipo no soportado: ${type}`)

    // Asegura que el input tenga el code inicial
    const createInput = { ...input, code: firstCode }

    // 1) Crear el descuento
    let createRes = await client.request(meta.m, { input: createInput })
    let payload = createRes?.data?.[meta.key]
    let nodeId = payload?.codeDiscountNode?.id
    let userErrors = payload?.userErrors ?? []

    // Si el code inicial está tomado, crea con un TEMP y luego lo agregas en bulk
    if (!nodeId && userErrors?.length) {
      const taken = userErrors.find(
        (e) =>
          String(e.message).toLowerCase().includes("unique") ||
          String(e.code || "").includes("TAKEN")
      )
      if (taken) {
        const tempCode = `TMP-${Date.now().toString(36)}`
        const createInputTmp = { ...input, code: tempCode }
        createRes = await client.request(meta.m, { input: createInputTmp })
        payload = createRes?.data?.[meta.key]
        nodeId = payload?.codeDiscountNode?.id
        userErrors = payload?.userErrors ?? []
        if (!nodeId) {
          throw new Error(
            `No se pudo crear el descuento: ${
              userErrors.map((e) => e.message).join("; ") || "desconocido"
            }`
          )
        }
        // el código "firstCode" se agregará vía bulk con el resto
        rest.unshift(firstCode)
      } else {
        throw new Error(
          `No se pudo crear el descuento: ${userErrors
            .map((e) => e.message)
            .join("; ")}`
        )
      }
    }

    // 2) Agregar TODOS los códigos restantes en lotes de 250
    const LOT = 250 // límite Shopify para bulk add
    const batches = this.chunk(rest, LOT)
    let created = 1 // ya contamos el primero
    let failed = 0

    for (const batch of batches) {
      if (batch.length === 0) continue
      const codesInput = batch.map((code) => ({ code }))
      const bulk = await client.request(this.BULK_ADD_CODES, {
        discountId: nodeId,
        codes: codesInput,
      })
      const bulkId = bulk?.data?.discountRedeemCodeBulkAdd?.bulkCreation?.id
      const errs = bulk?.data?.discountRedeemCodeBulkAdd?.userErrors ?? []
      if (errs.length) {
        throw new Error(
          `Error al iniciar bulkAdd: ${errs.map((e) => e.message).join("; ")}`
        )
      }
      const st = await this.waitBulk(bulkId)
      created += st.importedCount ?? 0
      failed += st.failedCount ?? 0
    }

    return { id: nodeId, created, failed, batches: batches.length }
  }
}

export default ShopifyImp
