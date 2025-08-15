import Klaviyo from "klaviyo-node"
import app from "../app.js"

class KlaviyoImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  init() {
    const { [`KLAVIYO_TOKEN_${this.shopAlias}`]: KLAVIYO_TOKEN } = app
    const client = new Klaviyo(KLAVIYO_TOKEN)
    return client
  }

  sendEvent(name, email, properties) {
    const client = this.init()
    client
      .track(
        name,
        email, // Identificador de usuario
        properties // Propiedades del evento
      )
      .then(() => console.log("Evento trackeado"))
      .catch((err) => console.error("Error:", err))
  }

  async klaviyoFetch(path, options = {}, token) {
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
          Authorization: `Klaviyo-API-Key ${token}`,
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
