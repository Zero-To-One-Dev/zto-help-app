import { HOSTNAME } from "../app.js";
import ConfigStores from '../services/config-stores.js';
import "@shopify/shopify-api/adapters/node"
import { shopifyApi, Session, LogSeverity } from "@shopify/shopify-api"
import logger from "../../logger.js"

class ShopifyImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  async init() {
    const STORES_INFORMATION = await ConfigStores.getStoresInformation();
    const SHOPIFY_API_KEY = STORES_INFORMATION[this.shopAlias].shopify_api_key;
    const SHOPIFY_API_SECRET_KEY = STORES_INFORMATION[this.shopAlias].shopify_secret_key;
    const SHOP_URL = STORES_INFORMATION[this.shopAlias].shopify_url;

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
    const client = await this.init()
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

  async getFirst10Orders() {
    const client = await this.init()
    return (
      await client.request(`
      query {
        orders (first: 10) {
          edges {
            cursor
            node {
              id
              name
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }  
    `)
    ).data.orders.edges
  }

  async getCustomerNameByEmail(email) {
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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
    const client = await this.init()
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

  /**
   * Obtiene los detalles completos de un draft order para crear una orden
   * @param {string} draftOrderId - GID o ID del draft order
   * @returns {Promise<object>} - Datos completos del draft order
   */
  async getDraftOrderDetails(draftOrderId) {
    const client = await this.init()
    const gid = String(draftOrderId).startsWith("gid://")
      ? draftOrderId
      : `gid://shopify/DraftOrder/${draftOrderId}`

    const query = `
      query {
        draftOrder(id: "${gid}") {
          id
          name
          status
          note2
          tags
          email
          phone
          taxExempt
          taxesIncluded
          currencyCode
          subtotalPriceSet {
            shopMoney { amount currencyCode }
          }
          totalPriceSet {
            shopMoney { amount currencyCode }
          }
          totalTax
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney { amount currencyCode }
                }
                discountedUnitPriceSet {
                  shopMoney { amount currencyCode }
                }
                variant {
                  id
                  title
                  sku
                  price
                }
                product {
                  id
                  title
                }
              }
            }
          }
          shippingLine {
            title
            originalPriceSet {
              shopMoney { amount currencyCode }
            }
          }
          appliedDiscount {
            title
            value
            valueType
            amount
          }
          customAttributes {
            key
            value
          }
        }
      }
    `

    const res = await client.request(query)
    return res.data?.draftOrder
  }

  /**
   * Completa un draft order y lo convierte en una orden real
   * @param {string} draftOrderId - GID o ID del draft order
   * @param {string} paymentPending - Si el pago está pendiente (para COD)
   * @returns {Promise<object>} - Orden creada
   */
  async completeDraftOrder(draftOrderId, paymentPending = true) {
    const client = await this.init()
    const gid = String(draftOrderId).startsWith("gid://")
      ? draftOrderId
      : `gid://shopify/DraftOrder/${draftOrderId}`

    const mutation = `
      mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
        draftOrderComplete(id: $id, paymentPending: $paymentPending) {
          draftOrder {
            id
            name
            status
            order {
              id
              name
              displayFinancialStatus
              tags
              note
              createdAt
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              shippingAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                zip
                country
                phone
              }
              lineItems(first: 100) {
                edges {
                  node {
                    title
                    quantity
                    variant {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const variables = {
      id: gid,
      paymentPending
    }

    const res = await client.request(mutation, { variables })
    const payload = res.data?.draftOrderComplete

    if (!payload) {
      throw new Error("draftOrderComplete sin payload de respuesta")
    }
    if (payload.userErrors && payload.userErrors.length) {
      const details = payload.userErrors
        .map((e) => `${e.field?.join(".") || "general"}: ${e.message}`)
        .join(" | ")
      throw new Error(`Shopify userErrors: ${details}`)
    }

    return payload.draftOrder
  }

  /**
   * Crea una orden a partir de un draft order con payment gateway específico (COD)
   * @param {object} draftOrderDetails - Detalles del draft order (de getDraftOrderDetails)
   * @param {object} options - Opciones adicionales { tags, note, gatewayName }
   * @returns {Promise<object>} - Orden creada
   */
  async createOrderFromDraftData(draftOrderDetails, options = {}) {
    const client = await this.init()
    const {
      tags = [],
      note = "",
      gatewayName = "Cash on Delivery (COD)"
    } = options

    // Construir line items desde el draft order
    const lineItems = draftOrderDetails.lineItems.edges.map(({ node }) => ({
      variantId: node.variant?.id,
      quantity: node.quantity,
    })).filter(item => item.variantId) // Solo incluir items con variant

    // Construir shipping address
    const shippingAddr = draftOrderDetails.shippingAddress
    const shippingAddress = shippingAddr ? {
      firstName: shippingAddr.firstName,
      lastName: shippingAddr.lastName,
      address1: shippingAddr.address1,
      address2: shippingAddr.address2 || undefined,
      city: shippingAddr.city,
      provinceCode: shippingAddr.provinceCode,
      countryCode: shippingAddr.countryCodeV2,
      zip: shippingAddr.zip,
      phone: shippingAddr.phone || undefined,
    } : undefined

    // Construir billing address
    const billingAddr = draftOrderDetails.billingAddress
    const billingAddress = billingAddr ? {
      firstName: billingAddr.firstName,
      lastName: billingAddr.lastName,
      address1: billingAddr.address1,
      address2: billingAddr.address2 || undefined,
      city: billingAddr.city,
      provinceCode: billingAddr.provinceCode,
      countryCode: billingAddr.countryCodeV2,
      zip: billingAddr.zip,
      phone: billingAddr.phone || undefined,
    } : undefined

    // Calcular el total para la transacción
    const totalAmount = draftOrderDetails.totalPriceSet?.shopMoney?.amount || "0"
    const currencyCode = draftOrderDetails.currencyCode || "USD"

    // Construir nota final
    const draftNote = draftOrderDetails.note2 || ""
    const finalNote = [draftNote, note].filter(Boolean).join("\n")

    // Construir tags finales
    const draftTags = draftOrderDetails.tags || []
    const allTags = [...new Set([...draftTags, ...tags])]

    // Custom attributes del draft + origen
    const customAttributes = [
      ...(draftOrderDetails.customAttributes || []),
      { key: "origin_draft_order_id", value: draftOrderDetails.id },
      { key: "origin_draft_order_name", value: draftOrderDetails.name },
    ]

    // Construir el input de la orden
    const orderInput = {
      lineItems,
      email: draftOrderDetails.email || undefined,
      phone: draftOrderDetails.phone || undefined,
      shippingAddress,
      billingAddress,
      note: finalNote || undefined,
      tags: allTags.length > 0 ? allTags : undefined,
      customAttributes,
      // Transacción con el gateway COD
      transactions: [
        {
          kind: "SALE",
          status: "PENDING",
          gateway: gatewayName,
          amountSet: {
            shopMoney: {
              amount: totalAmount,
              currencyCode,
            }
          }
        }
      ],
      // Shipping line si existe
      ...(draftOrderDetails.shippingLine ? {
        shippingLines: [{
          title: draftOrderDetails.shippingLine.title,
          priceSet: {
            shopMoney: {
              amount: draftOrderDetails.shippingLine.originalPriceSet?.shopMoney?.amount || "0",
              currencyCode,
            }
          }
        }]
      } : {}),
    }

    const mutation = `
      mutation OrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order {
            id
            name
            displayFinancialStatus
            tags
            note
            createdAt
            totalPriceSet {
              shopMoney { amount currencyCode }
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              zip
              country
              phone
            }
            customAttributes {
              key
              value
            }
            lineItems(first: 100) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    id
                    title
                  }
                }
              }
            }
          }
          userErrors { field message }
        }
      }
    `

    const variables = {
      order: orderInput,
      options: {
        inventoryBehaviour: "DECREMENT_IGNORING_POLICY"
      }
    }

    const res = await client.request(mutation, { variables })
    const payload = res.data?.orderCreate

    if (!payload) {
      throw new Error("orderCreate sin payload de respuesta")
    }
    if (payload.userErrors && payload.userErrors.length) {
      const details = payload.userErrors
        .map((e) => `${e.field?.join(".") || "general"}: ${e.message}`)
        .join(" | ")
      throw new Error(`Shopify userErrors: ${details}`)
    }

    return payload.order
  }

  async deleteDraftOrder(draftOrder) {
    const client = await this.init()
    return (
      await client.request(`mutation {
      draftOrderDelete (input: { id: "${draftOrder}" }) {
        deletedId
      }
    }`)
    ).data.draftOrderDelete.deletedId
  }

  async getLineItemsByOrder(orderId) {
    const client = await this.init()
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
    const client = await this.init()
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

  async getDiscountWithAllCodes(id) {
    const client = await this.init()
    if (!id) throw new Error("Falta id del descuento")

    const toGid = (v) =>
      String(v).startsWith("gid://")
        ? String(v)
        : `gid://shopify/DiscountCodeNode/${v}`

    const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const gid = toGid(id)

    const PAGE_SIZE = 250
    let after = null
    const allCodes = []
    let meta = null

    while (true) {
      const afterArg = after ? `, after: "${esc(after)}"` : ""
      const q = `
      {
        codeDiscountNode(id: "${esc(gid)}") {
          id
          codeDiscount {
            __typename
            ... on DiscountCodeBasic {
              title
              summary
              appliesOncePerCustomer
              asyncUsageCount
              usageLimit
              customerGets {
                value {
                  __typename
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount {
                    amount { amount currencyCode }
                    appliesOnEachItem
                  }
                }
                items { __typename }
              }
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
      const res = await client.request(q)
      const discount = res?.data?.codeDiscountNode?.codeDiscount
      if (!discount) throw new Error(`No se encontró DiscountCodeNode ${gid}`)

      if (!meta) {
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

  async getDiscountWithAllCodes(id) {
    const client = await this.init()
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
              customerGets {
                value {
                  __typename
                  ... on DiscountPercentage { percentage }
                  ... on DiscountAmount {
                    amount { amount currencyCode }
                    appliesOnEachItem
                  }
                }
                items { __typename }
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

  // === Helper: convierte context -> customerSelection para API 2025-01 ===
  sanitizeDiscountInputFor2025_01(type, input) {
    if (!input || type !== "DiscountCodeBasic") return input

    const out = { ...input }

    // Si el user pasó "context", lo mapeamos a customerSelection y lo quitamos
    if (out.context) {
      let cs = out.customerSelection

      // casos comunes:
      // - context: { all: 'ALL' } o Enum('ALL') o true
      const allFlag =
        out.context.all === true ||
        out.context.all === "ALL" ||
        (out.context.all && out.context.all.__enum === true)

      if (!cs) {
        if (allFlag) {
          cs = { all: true }
        } else if (
          Array.isArray(out.context.customers) &&
          out.context.customers.length
        ) {
          // Si venían GIDs de clientes, los reusamos como customerIds
          cs = { customerIds: out.context.customers }
        } else {
          // No podemos mapear segmentos entre tiendas en 2025-01; por defecto aplicamos a todos
          cs = { all: true }
        }
      }

      out.customerSelection = cs
      delete out.context
    }

    // Si no vino ninguna selección, fuerza "todos"
    if (!out.customerSelection) {
      out.customerSelection = { all: true }
    }

    return out
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

    const client = await this.init()
    const normalized = codes
      .map((c) => (typeof c === "string" ? c : c?.code))
      .filter(Boolean)

    // 🔧 Sanea input para API 2025-01 (quita "context" y asegura "customerSelection")
    input = this.sanitizeDiscountInputFor2025_01(type, input)

    // Si aún así te llega "context" por fuera, elimínalo a prueba de balas
    if ("context" in input) {
      const { context, ...rest } = input
      input = rest
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

    // Si el primer código está tomado, crea con TMP y agrega el real vía bulk
    if (!nodeId && userErrors.length) {
      const taken = userErrors.find(
        (e) =>
          `${e.message || ""} ${e.code || ""}`
            .toLowerCase()
            .includes("unique") ||
          `${e.code || ""}`.toUpperCase().includes("TAKEN")
      )
      if (!taken) {
        const details = userErrors
          .map((e) => `${e.field?.join?.(".") || "general"}: ${e.message}`)
          .join("; ")
        throw new Error(`No se pudo crear el descuento: ${details}`)
      }

      const tmpLiteral = this.toGqlInput({
        ...input,
        code: `TMP-${Date.now().toString(36)}`,
      })
      const createTmp = {
        DiscountCodeBasic: `mutation { discountCodeBasicCreate(basicCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeBxgy: `mutation { discountCodeBxgyCreate(bxgyCodeDiscount: ${tmpLiteral})    { codeDiscountNode { id } userErrors { field code message } } }`,
        DiscountCodeFreeShipping: `mutation { discountCodeFreeShippingCreate(freeShippingCodeDiscount: ${tmpLiteral}) { codeDiscountNode { id } userErrors { field code message } } }`,
      }[type]

      createRes = await client.request(createTmp)
      payload =
        createRes?.data?.discountCodeBasicCreate ??
        createRes?.data?.discountCodeBxgyCreate ??
        createRes?.data?.discountCodeFreeShippingCreate
      nodeId = payload?.codeDiscountNode?.id
      if (!nodeId) {
        const details = (payload?.userErrors || [])
          .map((e) => `${e.field?.join?.(".") || "general"}: ${e.message}`)
          .join("; ")
        throw new Error(
          `No se pudo crear el descuento (tmp): ${details || "desconocido"}`
        )
      }
      rest.unshift(initialCode)
    }

    // Bulk add (lotes de 250) – sin variables
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
      const start = await client.request(`
      mutation {
        discountRedeemCodeBulkAdd(discountId: "${this.gqlEscape(
          nodeId
        )}", codes: ${codesLiteral}) {
          bulkCreation { id }
          userErrors { field code message }
        }
      }`)
      const errs = start?.data?.discountRedeemCodeBulkAdd?.userErrors || []
      if (errs.length) {
        const details = errs
          .map((e) => `${e.field?.join?.(".") || "general"}: ${e.message}`)
          .join("; ")
        throw new Error(`Error al iniciar bulkAdd: ${details}`)
      }
      const bulkId = start?.data?.discountRedeemCodeBulkAdd?.bulkCreation?.id
      // poll básico
      let done = false,
        imported = 0,
        failedThis = 0
      while (!done) {
        const s = await client.request(
          `{ discountRedeemCodeBulkCreation(id: "${this.gqlEscape(
            bulkId
          )}") { id done importedCount failedCount } }`
        )
        const st = s?.data?.discountRedeemCodeBulkCreation
        done = !!st?.done
        imported = st?.importedCount ?? 0
        failedThis = st?.failedCount ?? 0
        if (!done) await this.sleep(1000)
      }
      created += imported
      failed += failedThis
    }

    return { id: nodeId, created, failed }
  }
}

export default ShopifyImp
