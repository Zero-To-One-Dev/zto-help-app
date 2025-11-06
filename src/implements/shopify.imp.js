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

  // ===== Helpers =====
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }
  chunk(arr, size) {
    const out = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }
  gqlEscape(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
  }
  /**
   * Marca valores como ENUM para no comillarlos en el input GraphQL
   * Ej: Enum('ORDER_SUBTOTAL') -> ORDER_SUBTOTAL
   */
  Enum(value) {
    return { __enum: true, value }
  }
  /**
   * Convierte un valor JS a literal de input GraphQL (sin variables)
   * - strings -> "..."
   * - numbers/booleans -> tal cual
   * - Date -> ISO string
   * - arrays/objects -> recursivo
   * - this.Enum('X') -> X (sin comillas)
   */
  toGqlInput(value) {
    if (value === null) return "null"
    if (value === undefined) return "null"
    if (value && typeof value === "object" && value.__enum)
      return String(value.value)
    const t = typeof value
    if (t === "string") return `"${this.gqlEscape(value)}"`
    if (t === "number" || t === "boolean") return String(value)
    if (value instanceof Date) return `"${value.toISOString()}"`
    if (Array.isArray(value))
      return `[${value.map((v) => this.toGqlInput(v)).join(", ")}]`
    // objeto
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${this.toGqlInput(v)}`)
    return `{ ${entries.join(", ")} }`
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

  async waitBulkNoVars(
    bulkId,
    { intervalMs = 1000, timeoutMs = 10 * 60 * 1000 } = {}
  ) {
    const client = this.init()
    const started = Date.now()
    while (true) {
      const q = `
        {
          discountRedeemCodeBulkCreation(id: "${this.gqlEscape(bulkId)}") {
            id
            done
            codesCount
            importedCount
            failedCount
          }
        }
      `
      const { data, errors } = await client.request(q)
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

  /**
   * Crea un descuento y agrega TODOS los códigos por lotes (sin variables GraphQL)
   * @param {'DiscountCodeBasic'|'DiscountCodeBxgy'|'DiscountCodeFreeShipping'} type
   * @param {object} input  Input EXACTO del tipo Shopify (fechas, customerGets/items, etc.)
   * @param {Array<string|{code:string}>} codes  Todos los códigos (1..10k)
   * @returns {Promise<{id:string, created:number, failed:number, batches:number}>}
   */
  async createDiscountWithCodes(type, input, codes) {
    if (!type) throw new Error("Falta type")
    if (!input) throw new Error("Falta input del descuento")
    if (!codes?.length) throw new Error("Debes pasar al menos un código")

    const client = this.init()

    // Normaliza códigos
    const normalized = codes
      .map((c) => (typeof c === "string" ? c : c?.code))
      .filter(Boolean)
    // Código inicial: si input ya trae "code" lo respetamos; si no, usamos el primero
    const initialCode = input.code ?? normalized[0]
    if (!initialCode)
      throw new Error("No hay código inicial para crear el descuento")

    const rest = input.code ? normalized : normalized.slice(1)

    // 1) Crear el descuento según tipo (sin variables)
    const inputWithCode = { ...input, code: initialCode }
    const inputLiteral = this.toGqlInput(inputWithCode)

    const mutationByType = {
      DiscountCodeBasic: `mutation { discountCodeBasicCreate(basicCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      DiscountCodeBxgy: `mutation { discountCodeBxgyCreate(bxgyCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      DiscountCodeFreeShipping: `mutation { discountCodeFreeShippingCreate(freeShippingCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
    }
    const createMutation = mutationByType[type]
    if (!createMutation) throw new Error(`Tipo no soportado: ${type}`)

    let createRes = await client.request(createMutation)
    let payload =
      createRes?.data?.discountCodeBasicCreate ??
      createRes?.data?.discountCodeBxgyCreate ??
      createRes?.data?.discountCodeFreeShippingCreate
    let nodeId = payload?.codeDiscountNode?.id
    let userErrors = payload?.userErrors ?? []

    // Si el primer código está tomado, crea con un código temporal y agrega el inicial vía bulk
    if (!nodeId && userErrors.length) {
      const taken = userErrors.find(
        (e) =>
          `${e.message || ""} ${e.code || ""}`
            .toLowerCase()
            .includes("unique") ||
          `${e.code || ""}`.toUpperCase().includes("TAKEN")
      )
      if (!taken) {
        throw new Error(
          `No se pudo crear el descuento: ${userErrors
            .map((e) => e.message)
            .join("; ")}`
        )
      }
      const tempCode = `TMP-${Date.now().toString(36)}`
      const tmpLiteral = this.toGqlInput({ ...input, code: tempCode })
      const createMutationTmp = {
        DiscountCodeBasic: `mutation { discountCodeBasicCreate(basicCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeBxgy: `mutation { discountCodeBxgyCreate(bxgyCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeFreeShipping: `mutation { discountCodeFreeShippingCreate(freeShippingCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      }[type]

      createRes = await client.request(createMutationTmp)
      payload =
        createRes?.data?.discountCodeBasicCreate ??
        createRes?.data?.discountCodeBxgyCreate ??
        createRes?.data?.discountCodeFreeShippingCreate
      nodeId = payload?.codeDiscountNode?.id
      userErrors = payload?.userErrors ?? []
      if (!nodeId) {
        throw new Error(
          `No se pudo crear el descuento (tmp): ${
            userErrors.map((e) => e.message).join("; ") || "desconocido"
          }`
        )
      }
      // agrega el código inicial al lote
      rest.unshift(initialCode)
    }

    // 2) Agregar el resto de códigos por lotes (250) con bulkAdd (sin variables)
    const LOT = 250
    const batches = this.chunk(rest, LOT)
    let created = 1 // ya contamos el inicial
    let failed = 0

    for (const batch of batches) {
      if (!batch.length) continue
      const codesInput = batch.map((code) => ({ code }))
      const codesLiteral = this.toGqlInput(codesInput)
      const m = `
        mutation {
          discountRedeemCodeBulkAdd(
            discountId: "${this.gqlEscape(nodeId)}",
            codes: ${codesLiteral}
          ) {
            bulkCreation { id }
            userErrors { field code message }
          }
        }
      `
      const bulk = await client.request(m)
      const errs = bulk?.data?.discountRedeemCodeBulkAdd?.userErrors ?? []
      if (errs.length) {
        throw new Error(
          `Error al iniciar bulkAdd: ${errs.map((e) => e.message).join("; ")}`
        )
      }
      const bulkId = bulk?.data?.discountRedeemCodeBulkAdd?.bulkCreation?.id
      if (!bulkId) throw new Error("No se obtuvo el id del bulk creation")

      const st = await this.waitBulkNoVars(bulkId)
      created += st?.importedCount ?? 0
      failed += st?.failedCount ?? 0
    }

    return { id: nodeId, created, failed, batches: batches.length }
  }
}

export default ShopifyImp
