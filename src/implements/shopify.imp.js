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
    if (value === null || value === undefined) return "null"
    if (value && typeof value === "object" && value.__enum)
      return String(value.value)
    const t = typeof value
    if (t === "string") return `"${this.gqlEscape(value)}"`
    if (t === "number" || t === "boolean") return String(value)
    if (value instanceof Date) return `"${value.toISOString()}"`
    if (Array.isArray(value))
      return `[${value.map((v) => this.toGqlInput(v)).join(", ")}]`
    return `{ ${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${this.toGqlInput(v)}`)
      .join(", ")} }`
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
      const q = `
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
              // Traemos el valor del descuento
              customerGets {
                value {
                  __typename
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount {
                    amount { amount currencyCode }
                    appliesOnEachItem
                  }
                }
                items { __typename } // placeholder por si luego necesitas copiar el scope
              }
              codes(first: ${PAGE_SIZE}${afterArg}) {
                pageInfo { hasNextPage endCursor }
                nodes { id code }
              }
            }
          }
        }
      }
    `
      const res = await client.request(q)
      const discount = res?.data?.codeDiscountNode?.codeDiscount
      if (!discount) throw new Error(`No se encontró DiscountCodeNode ${gid}`)

      if (!meta) {
        // mapeamos valor (si es % guardamos percentage, si fuera monto dejamos amount)
        let value = null
        const v = discount.customerGets?.value
        if (v?.__typename === "DiscountPercentage") {
          value = { type: "percentage", percentage: v.percentage }
        } else if (v?.__typename === "DiscountAmount") {
          value = {
            type: "amount",
            amount: v.amount?.amount,
            currencyCode: v.amount?.currencyCode,
            appliesOnEachItem: !!v.appliesOnEachItem,
          }
        }
        meta = {
          typename: discount.__typename,
          title: discount.title,
          summary: discount.summary ?? null,
          appliesOncePerCustomer: discount.appliesOncePerCustomer ?? null,
          asyncUsageCount: discount.asyncUsageCount ?? null,
          usageLimit: discount.usageLimit ?? null,
          value,
        }
      }

      const page = discount.codes
      allCodes.push(...page.nodes.map((n) => ({ id: n.id, code: n.code })))
      if (!page.pageInfo.hasNextPage) break
      after = page.pageInfo.endCursor
    }

    return { ...meta, codes: allCodes }
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
    const normalized = codes
      .map((c) => (typeof c === "string" ? c : c?.code))
      .filter(Boolean)

    // ---- FIX: si no viene context, lo forzamos a TODOS los compradores ----
    if (!input.context && !input.customerSelection) {
      input = { ...input, context: { all: this.Enum("ALL") } } // evita "Customer selection can't be blank"
    }

    const initialCode = input.code ?? normalized[0]
    if (!initialCode)
      throw new Error("No hay código inicial para crear el descuento")
    const rest = input.code ? normalized : normalized.slice(1)

    const inputLiteral = this.toGqlInput({ ...input, code: initialCode })
    const createMutation = {
      DiscountCodeBasic: `mutation { discountCodeBasicCreate(basicCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      DiscountCodeBxgy: `mutation { discountCodeBxgyCreate(bxgyCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      DiscountCodeFreeShipping: `mutation { discountCodeFreeShippingCreate(freeShippingCodeDiscount: ${inputLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
    }[type]
    if (!createMutation) throw new Error(`Tipo no soportado: ${type}`)

    let createRes = await client.request(createMutation)
    let payload =
      createRes?.data?.discountCodeBasicCreate ??
      createRes?.data?.discountCodeBxgyCreate ??
      createRes?.data?.discountCodeFreeShippingCreate
    let nodeId = payload?.codeDiscountNode?.id
    let userErrors = payload?.userErrors ?? []

    if (!nodeId && userErrors.length) {
      const taken = userErrors.find(
        (e) =>
          `${e.message || ""} ${e.code || ""}`
            .toLowerCase()
            .includes("unique") ||
          `${e.code || ""}`.toUpperCase().includes("TAKEN")
      )
      if (!taken)
        throw new Error(
          `No se pudo crear el descuento: ${userErrors
            .map((e) => e.message)
            .join("; ")}`
        )
      const tmpLiteral = this.toGqlInput({
        ...input,
        code: `TMP-${Date.now().toString(36)}`,
      })
      const createTmp = {
        DiscountCodeBasic: `mutation { discountCodeBasicCreate(basicCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeBxgy: `mutation { discountCodeBxgyCreate(bxgyCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeFreeShipping: `mutation { discountCodeFreeShippingCreate(freeShippingCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      }[type]
      createRes = await client.request(createTmp)
      payload =
        createRes?.data?.discountCodeBasicCreate ??
        createRes?.data?.discountCodeBxgyCreate ??
        createRes?.data?.discountCodeFreeShippingCreate
      nodeId = payload?.codeDiscountNode?.id
      if (!nodeId)
        throw new Error(
          `No se pudo crear el descuento (tmp): ${
            (payload?.userErrors || []).map((e) => e.message).join("; ") ||
            "desconocido"
          }`
        )
      // agregamos el código real al bulk
      rest.unshift(initialCode)
    }

    // --- bulk add (sin variables) ---
    const LOT = 250
    const chunk = (arr, size) =>
      arr.reduce(
        (a, _, i) => (
          i % size ? a[a.length - 1].push(arr[i]) : a.push([arr[i]]), a
        ),
        []
      )
    let created = 1,
      failed = 0
    for (const batch of chunk(rest, LOT)) {
      if (!batch.length) continue
      const codesLiteral = this.toGqlInput(batch.map((code) => ({ code })))
      const m = `
      mutation {
        discountRedeemCodeBulkAdd(discountId: "${this.gqlEscape(
          nodeId
        )}", codes: ${codesLiteral}) {
          bulkCreation { id }
          userErrors { field code message }
        }
      }
    `
      const start = await client.request(m)
      const errs = start?.data?.discountRedeemCodeBulkAdd?.userErrors || []
      if (errs.length)
        throw new Error(
          `Error al iniciar bulkAdd: ${errs.map((e) => e.message).join("; ")}`
        )
      const bulkId = start?.data?.discountRedeemCodeBulkAdd?.bulkCreation?.id
      const statusQ = `
      { discountRedeemCodeBulkCreation(id: "${this.gqlEscape(bulkId)}") {
          id done importedCount failedCount
        }
      }`
      // poll básico
      let done = false,
        imported = 0,
        failedThis = 0
      while (!done) {
        const s = await client.request(statusQ)
        const st = s?.data?.discountRedeemCodeBulkCreation
        done = !!st?.done
        imported = st?.importedCount ?? 0
        failedThis = st?.failedCount ?? 0
        if (!done) await new Promise((r) => setTimeout(r, 1000))
      }
      created += imported
      failed += failedThis
    }

    return { id: nodeId, created, failed }
  }
}

export default ShopifyImp
