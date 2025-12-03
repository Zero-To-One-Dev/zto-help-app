import extraHealthImp from "../implements/extra-health.imp.js";
import { sequelize, Member, ProductSubscription, Dependent } from '../repositories/extrahealth.repository.js'; // ajusta tu ruta

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
// const updateMemberJob = async (memberId, fields) => {
//   try {
//     await extrahealth.updateUser(memberId, fields);
//     console.log(`Member ${memberId} updated successfully.`);
//   } catch (error) {
//     console.error(`Error updating member ${memberId}:`, error);
//   }
// }
// updateMemberJob(685150581, newInfo);

// smoke-test.js
// const nn = v => (v === undefined ? null : v);

async function run() {
  await sequelize.authenticate();

  // 1) Crear Member (idempotente por customer_id)
  const [member] = await Member.findOrCreate({
    where: { customer_id: 1391 },
    defaults: {
      customer_id: 1391,
      status: 'CREATED',                // ENUM: 'CREATED' | 'ENROLLED' | 'ON_HOLD' | 'CANCEL'
      firstname: 'Ana',
      lastname: 'Pérez',
      birthday: new Date('1990-04-12'),
      gender: 'Female',                 // ENUM
      phone_number: '+57 300 000 0000',
      phone_device: 'Android',          // ENUM
      email: 'ana@example.com',
      address: 'Calle 1 #2-3',
      state: 'Cundinamarca',
      zipcode: '110111',
    },
  });

  // 2) Crear ProductSubscription (idempotente por contract_id)
  const [product] = await ProductSubscription.findOrCreate({
    where: { contract_id: '555001' },   // tu UNIQUE real
    defaults: {
      member_id: member.id,
      skio_subscription_id: 'skio_abc123',
      contract_id: '555001',
      pdid: '1001',
      dtEffective: new Date(),
      bPaid: true,
      dtBilling: new Date(),
      dtRecurring: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      status: 'ACTIVE',                 // ENUM: 'ACTIVE' | 'ON_HOLD' | 'CANCEL'
    },
  });

  // 3) Crear Dependent ligado a ese product
  const dep = await Dependent.create({
    product_subscription_id: product.id,
    firstname: 'Carlos',
    lastname: 'Pérez',
    birthday: '2012-09-03',             // DATEONLY en modelo → string YYYY-MM-DD
    relationship: 'Child',              // ENUM: 'Spouse' | 'Child'
    gender: 'Male',                     // ENUM
    email: 'carlos@example.com',
  });

  // 4) Leer todo con include
  const fullMember = await Member.findByPk(member.id, {
    include: [{ model: ProductSubscription, as: 'products', include: [{ model: Dependent, as: 'dependents' }] }],
  });

  console.log('Member id:', member.id);
  console.log('Product id:', product.id);
  console.log('Dependent id:', dep.id);
  console.log('Resumen:', JSON.stringify(fullMember.toJSON(), null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});