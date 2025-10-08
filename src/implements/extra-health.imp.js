/*
  DOCUMENTACION 
  Hay dos APIs, hay que usar las dos por que ambas estan limitadas, por lo tanto se complementan entre ellas.

  1. Gorgias API
  2. Extra Health API

*/


class ExtraHealthImp {
  constructor(emailSender = 'support@b2cresponse.gorgias.io') {
    this.baseURL = process.env.GORGIAS_API_URL;
    this.authHeader = process.env.GORGIAS_API_KEY;
  }

  init() {
    // Aquí puedes inicializar cosas si lo necesitas (por ejemplo logging o config externa)
  }

  async createUser(ticketId) {
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
}

export default ExtraHealthImp;