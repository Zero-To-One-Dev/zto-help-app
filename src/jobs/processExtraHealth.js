import extraHealthImp from "../implements/extraHealth.imp.js";
import { sequelize, Member, ProductSubscription, Dependent } from '../repositories/extrahealth.repository.js'; // ajusta tu ruta
import { updateProductSubscriptionById } from '../services/localExtraHealth.js';
import { firstDayOfNextMonth, recurringBillingDate } from '../services/billingExtraHealth.js';

import SkioImp from "../implements/skio.imp.js";

const extrahealth = new extraHealthImp()
const newInfo = {
  "CORPID": 1391,
  "AGENT": 882722,
  "FIRSTNAME": "Jonathan UP",
  "MIDDLENAME": "",
  "LASTNAME": "Samsung",
  "DOB": "03/13/1974",
  "GENDER": "M",
  "ADDRESS1": "8601 NW 27 ST",
  "ADDRESS2": "",
  "CITY": "Doral",
  "STATE": "FL",
  "ZIPCODE": "33122",
  "EMAIL": "jrivero@extrahealthmd.com",
  "PHONE1": "1231231234",
  "PHONE2": "",
  "SSN": "",
  "HEIGHT": 68,
  "WEIGHT": "200",
  "TOBACCO": "N",
  "DEPENDENTS": [],
}

const skioImp = new SkioImp("VS"); // Reemplaza con el alias de tu tienda

async function run() {
  const dtEffective = firstDayOfNextMonth();
  const dtRecurring = recurringBillingDate(dtEffective, 4);

  const updatedR = await skioImp.updateNextBillingDate('160edae3-f086-4956-afd0-903d104808ca', dtRecurring.toISOString());
  console.log(updatedR);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});