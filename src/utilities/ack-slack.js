export const ackSlack = (res, body = { response_action: "clear" }) => {
  // Slack exige responder rápido. Cerramos la respuesta y luego seguimos trabajando.
  if (!res.headersSent) res.status(200).json(body)
}
