import ConfigStores from '../../../services/config-stores.js';

class StoreRepository {
  /**
   * Buscar tienda por url_domain (url completa de Shopify)
   * Ejemplos: "myshop.myshopify.com", "https://myshop.myshopify.com"
   */
  async findByUrlDomain(storeUrl) {
    // Normalizar URL removiendo https:// y trailing slash
    const normalizedUrl = storeUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    // Intentar con URL normalizada
    let store = await ConfigStores.getShopsOrigin(normalizedUrl);
    
    // Intentar con https://
    if (!store) {
      store = await ConfigStores.getShopsOrigin(`https://${normalizedUrl}`);
    }

    // Si no se encuentra, buscar en todas las tiendas comparando url_domain
    if (!store) {
      const allStores = await ConfigStores.getShopsOrigin();
      store = Object.values(allStores).find(s => 
        s.url_domain === normalizedUrl || 
        s.url_domain === `https://${normalizedUrl}` ||
        s.url_domain?.replace(/^https?:\/\//, '').replace(/\/$/, '') === normalizedUrl
      );
    }

    return store || null;
  }

  /**
   * Buscar tienda por ID
   */
  async findById(id) {
    const allStores = await ConfigStores.getShopsOrigin();
    const store = Object.values(allStores).find(s => s.id === parseInt(id));
    return store || null;
  }
}

export default StoreRepository;
