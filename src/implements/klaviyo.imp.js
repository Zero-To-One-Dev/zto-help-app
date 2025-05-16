import Klaviyo from 'klaviyo-node';
import app from '../app.js';

class KlaviyoImp {
  constructor(shopAlias) {
    this.shopAlias = shopAlias
  }

  init() {
    const { [`KLAVIYO_TOKEN_${this.shopAlias}`]: KLAVIYO_TOKEN } = app;
    client = new Klaviyo(KLAVIYO_TOKEN);
    return client;
  }

  sendEvent (name, email, properties) {
    client.track(
      name,
      { '$email': email },      // Identificador de usuario
      ...properties        // Propiedades del evento
    )
    .then(() => console.log('Evento trackeado'))
    .catch(err => console.error('Error:', err));
  }
}

export default KlaviyoImp;