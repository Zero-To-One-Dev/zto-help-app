import { sha512 } from 'js-sha512';
import DBRepository from '../repositories/postgres.repository.js';

const dbRepository = new DBRepository();

const generateHashApiToken = async (nameApp, secret) => {
    const hashApiToken = sha512(secret);
    const suffixApiToken = secret.slice(-4);
    console.log(`For ${nameApp}\nAPI_TOKEN: ${secret}\nHASH_API_TOKEN: ${hashApiToken}\n`);
    await dbRepository.saveHashApiToken(nameApp, hashApiToken, suffixApiToken);
}

export async function execute(args) {
   await generateHashApiToken(args[2], args[3]);
}
