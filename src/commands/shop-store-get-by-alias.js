import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

/**
 * Executes a command to get all stores from the database.
 * @param {string[]} args - The arguments to the command. The first argument is the store alias to retrieve.
 * @returns {Promise<void>} Resolves when the stores have been retrieved.
 * @example
 * node index.js console shop-store-get-by-alias DM
 */
export async function execute(args) {
    const repository = new PostgresShopStoresRepository();

    const res = await repository.getAllWithKey('alias');
    console.log(`Store: ${args[2]}`);
    console.log(res[args[2]]);
}
