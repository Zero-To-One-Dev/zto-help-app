import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

export default class ConfigStores {

    static repo = null;
    static SHOPS_ORIGIN = null;
    static STORES_INFORMATION = null;

    static async getShopsOrigin() {
        if(!this.repo) {
            this.repo = new PostgresShopStoresRepository();
        }
        return await this.repo.getAllWithKey();
    }

    static async getStoresInformation() {
        if(!this.repo) {
            this.repo = new PostgresShopStoresRepository();
        }
        return await this.repo.getAllWithKey('alias');
    }
}
