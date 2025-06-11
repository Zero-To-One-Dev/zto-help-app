const baseURL = process.env.GORGIAS_API_URL;
const encodedAuth = process.env.GORGIAS_API_KEY;

class GorgiasImp {
  constructor(emailSender = 'support@b2cresponse.gorgias.io') {
    this.baseURL = process.env.GORGIAS_API_URL;
    this.authHeader = process.env.GORGIAS_API_KEY;
    this.emailSender = emailSender;
  }

  init() {
    // Aquí puedes inicializar cosas si lo necesitas (por ejemplo logging o config externa)
  }

  cleanMessage(bodyText) {
    if (bodyText === null || bodyText === undefined) return '';
    return bodyText
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/ +/g, ' ')
      .trim();
  }

  async getTicket(ticketId) {
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: this.authHeader
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} - ${text}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error al obtener el ticket ${ticketId}:`, error.message);
    }
  }

  async addTicketTag(ticketId, tag) {
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}/tags`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: this.authHeader
        },
        body: JSON.stringify({ names: [tag] })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error(`Error al agregar tag al ticket ${ticketId}:`, error.message);
    }
  }

  async updateTicketStatus(ticketId, statusTicket) {
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: this.authHeader
        },
        body: JSON.stringify({ status: `${statusTicket}` })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status} - ${text}`);
      }
    } catch (error) {
      console.error(`Error al actualizar el ticket ${ticketId}:`, error.message);
    }
  }

  async sendMessageTicket(ticketId, message, channel, source, receiver) {
    try {
      const response = await fetch(`${this.baseURL}/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: this.authHeader
        },
        body: JSON.stringify({
          channel,
          from_agent: true,
          public: true,
          via: 'api',
          source,
          receiver,
          sender: {
            email: this.emailSender
          },
          body_text: message,
          body_html: message,
          subject: 'Collaboration with us'
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
}

export default GorgiasImp;
