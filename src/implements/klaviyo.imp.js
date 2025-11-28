import Klaviyo from "klaviyo-node"
import ConfigStores from '../services/config-stores.js';

class KlaviyoImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias;
  }

  async sendEvent(name, email, properties) {
    const STORES_INFORMATION = await ConfigStores.getStoresInformation();
    const KLAVIYO_TOKEN = STORES_INFORMATION[this.shopAlias].klaviyo_token;
    const client = new Klaviyo(KLAVIYO_TOKEN);
    client
      .track(
        name,
        email, // Identificador de usuario
        properties // Propiedades del evento
      )
      .then(() => console.log("Evento trackeado"))
      .catch((err) => console.error("Error:", err))
  }

  async klaviyoFetch(path, options = {}) {
    const STORES_INFORMATION = await ConfigStores.getStoresInformation();
    const KLAVIYO_PRIVATE_API_KEY = STORES_INFORMATION[this.shopAlias].klaviyo_private_api_key;

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 15000
    )

    const { KLAVIYO_REVISION, KLAVIYO_API_BASE_URL } = process.env

    try {
      const res = await fetch(`${KLAVIYO_API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Klaviyo-API-Key ${KLAVIYO_PRIVATE_API_KEY}`,
          revision: KLAVIYO_REVISION,
          "Idempotency-Key": options.idempotencyKey ?? undefined, // used for POST /profiles
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      const contentType = res.headers.get("content-type") || ""
      const isJson =
        contentType.includes("application/vnd.api+json") ||
        contentType.includes("application/json")

      let data = null
      if (res.status !== 204) {
        data = isJson ? await res.json() : await res.text()
      }

      if (!res.ok) {
        const err = new Error("Klaviyo request failed")
        err.status = res.status
        err.data = data
        throw err
      }

      return { status: res.status, data }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export default KlaviyoImp
