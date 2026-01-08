import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

export default class ConfigStores {

    static repo = null;
    static SHOPS_ORIGIN = null;
    static STORES_INFORMATION = null;

    static async getShopsOrigin(urlDomain = null) {
        if(!this.repo) {
            this.repo = new PostgresShopStoresRepository();
        }
        const allStores = await this.repo.getAllWithKey();
        return urlDomain ? allStores[urlDomain] || null : allStores;
    }

    static async getStoresInformation() {
        if(!this.repo) {
            this.repo = new PostgresShopStoresRepository();
        }
        return await this.repo.getAllWithKey('alias');
    }
}
