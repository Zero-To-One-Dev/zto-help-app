import { sha512 } from 'js-sha512';
import { SECRET_HS, SECRET_CS, SECRET_RS, SECRET_VS, SECRET_DM, SECRET_MW } from '../app.js';
import DBRepository from '../repositories/postgres.repository.js';

const dbRepository = new DBRepository();

const generateHashApiToken = async (nameApp, secret) => {
    const hashApiToken = sha512(secret);
    const suffixApiToken = secret.slice(-4);
    console.log(`For ${nameApp}\nAPI_TOKEN: ${secret}\nHASH_API_TOKEN: ${hashApiToken}\n`);
    await dbRepository.saveHashApiToken(nameApp, hashApiToken, suffixApiToken);
}

(async () => {
    await generateHashApiToken('hotshapers', SECRET_HS);
    await generateHashApiToken('copperslim', SECRET_CS);
    await generateHashApiToken('redusculpt', SECRET_RS);
    await generateHashApiToken('vibrosculpt', SECRET_VS);
    await generateHashApiToken('drming', SECRET_DM);
    await generateHashApiToken('myway', SECRET_MW);
})();
