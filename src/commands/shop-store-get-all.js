import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

/**
 * Executes a command to get all stores from the database.
 * @param {string[]} args - The arguments to the command. The first argument is the field to retrieve.
 * @returns {Promise<void>} Resolves when the stores have been retrieved.
 * @example
 * node index.js console shop-store-get-all
 * node index.js console shop-store-get-all alias
 * node index.js console shop-store-get-all id
 * node index.js console shop-store-get-all color
 */
export async function execute(args) {
    const repository = new PostgresShopStoresRepository();
    const field = args[2] ?? "url_domain";

    const res = await repository.getAllWithKey(field);
    console.log("Store:\n", res);
}
