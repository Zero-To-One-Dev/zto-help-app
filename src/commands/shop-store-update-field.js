import PostgresShopStoresRepository from "../repositories/postgresshopstores.repository.js";

/**
 * Updates a field in a shop store.
 * @param {string[]} args - The arguments to the command. The alias of the shop store, the name of the field to update and the value to update it to.
 * @returns {Promise<void>} Resolves when the field has been updated.
 * @example
 * node index.js console shop-store-update-field CS color "#CB8371"
 */
export async function execute(args) {
    const repository = new PostgresShopStoresRepository();

    // alias, fieldname, value
    const res = await repository.updateField(args[2], args[3], args[4]);
    console.log("Updated:", res);
    const res2 = await repository.getAllWithKey('alias');
    console.log(`${args[2]} - ${args[3]} = '${res2[args[2]][args[3]]}'`);
}
