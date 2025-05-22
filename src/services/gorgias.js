const baseURL = `https://b2cresponse.gorgias.com/api`;
export const emailSender = 'support@b2cresponse.gorgias.io'

export const cleanMessage = (bodyText) => {
  if( bodyText === null || bodyText === undefined) return ''
  return bodyText
    .replace(/\n+/g, ' ')           // Reemplaza saltos de línea por espacio
    .replace(/\s+/g, ' ')           // Colapsa múltiples espacios a uno solo
    .replace(/ +/g, ' ')            // Limpia espacios adicionales
    .trim();                        // Quita espacios al inicio y final
};
export const getTicket = async (ticketId) => {
  try {
    const response = await fetch(`${baseURL}/tickets/${ticketId}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: 'Basic amJlY2VycmFAemVyb3Rvb25lZ3JvdXAuY29tOmRjZjA0NjU0ZjZlYTJjNzYzMWM2N2ZhZGQyYWRhODdmMjU1ZTI2MmZkZmI1MDc0ODVjNDM3YTFlZmVjYWJjMTY='
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} - ${text}`);
    }

    const data = await response.json();
    return data
  } catch (error) {
    console.error(`Error al obtener los mensajes del ticket ${ticketId}:`, error.message);
  }
}
export const addTicketTag = async (ticketId, tag) => {
  try {
    const response = await fetch(`${baseURL}/tickets/${ticketId}/tags`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic amJlY2VycmFAemVyb3Rvb25lZ3JvdXAuY29tOmRjZjA0NjU0ZjZlYTJjNzYzMWM2N2ZhZGQyYWRhODdmMjU1ZTI2MmZkZmI1MDc0ODVjNDM3YTFlZmVjYWJjMTY='
      },
      body: JSON.stringify({names: [`${tag}`]})
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error(`Error al agregar tag al ticket ${ticketId}:`, error.message);
  }
}
export const sendMessageTicket = async (ticketId, message, channel, source, receiver) => {
  try {
    const response = await fetch(`${baseURL}/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Basic amJlY2VycmFAemVyb3Rvb25lZ3JvdXAuY29tOmRjZjA0NjU0ZjZlYTJjNzYzMWM2N2ZhZGQyYWRhODdmMjU1ZTI2MmZkZmI1MDc0ODVjNDM3YTFlZmVjYWJjMTY='
      },
      body: JSON.stringify({
        channel: `${channel}`,
        from_agent: true,
        public: true,
        via: 'api',
        source: source,
        receiver: receiver,
        sender: {
          email: `${emailSender}`
        },
        body_text: `${message}`,
        body_html: `${message}`,
        subject: "Collaboration with us"
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error(`Error al enviar mensaje al ticket ${ticketId}:`, error.message);
  }
}