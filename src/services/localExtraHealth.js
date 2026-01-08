import { sequelize, Member, ProductSubscription, Dependent } from '../repositories/extrahealth.repository.js'; // ajusta tu ruta

const nn = v => (v === undefined ? null : v);
const pick = (obj, allowed) =>
  Object.fromEntries(Object.entries(obj).filter(([k, v]) => allowed.includes(k) && v !== undefined));

//--MEMBER FUNCTIONS
const MEMBER_UPDATABLE_FIELDS = [
  'extrahealth_id',
  'status',
  'firstname',
  'lastname',
  'birthday',
  'gender',
  'phone_number',
  'phone_device',
  'email',
  'address',
  'state',
  'zipcode',
];


export async function upsertMemberFromShopify(data) {
  const [member] = await Member.findOrCreate({
    where: { customer_id: data.customer_id },
    defaults: {
      customer_id: data.customer_id,
      status: data.status ?? 'CREATED',
      firstname: nn(data.firstname),
      lastname: nn(data.lastname),
      birthday: nn(data.birthday),
      gender: nn(data.gender),
      phone_number: nn(data.phone_number),
      phone_device: nn(data.phone_device),
      email: nn(data.email),
      address: nn(data.address),
      state: nn(data.state),
      zipcode: nn(data.zipcode),
    },
  });
  return member;
}

export async function updateMemberByCustomerId(customerId, patch) {
  const data = pick(patch, MEMBER_UPDATABLE_FIELDS);

  const [updatedCount] = await Member.update(data, {
    where: { customer_id: String(customerId) }, // customer_id lo vas a pasar a string
  });

  return updatedCount > 0;
}

export async function setExtraHealthIdByCustomerId(customerId, extrahealthId) {
  return updateMemberByCustomerId(customerId, { extrahealth_id: extrahealthId });
}

//--PRODUCT FUNCTIONS
const PRODUCT_UPDATABLE_FIELDS = [
  'member_id',
  'skio_subscription_id',
  'contract_id',
  'pdid',
  'dtEffective',
  'bPaid',
  'dtBilling',
  'dtRecurring',
  'dtCancelled',
  'status',
];

export async function createProductSubscription(memberId, productData) {
  // Importante: contract_id en tu BD es integer UNIQUE
  // Si aún NO lo tienes, contract_id debe ser null (y el UNIQUE no aplica a null)
  const product = await ProductSubscription.create({
    member_id: memberId,
    contract_id: nn(productData.contract_id),           // null inicialmente
    skio_subscription_id: nn(productData.skio_subscription_id), // null inicialmente
    pdid: nn(productData.pdid ?? 45750),                         // puede venir o no
    status: nn(productData.status ?? 'ACTIVE'),         // o null si prefieres
    dtEffective: nn(productData.dtEffective),
    bPaid: nn(productData.bPaid ?? true),
    dtBilling: nn(productData.dtBilling),
    dtRecurring: nn(productData.dtRecurring),
    dtCancelled: nn(productData.dtCancelled),
  });

  return product;
}

export async function updateProductSubscriptionById(memberId, patch) {
  const data = pick(patch, PRODUCT_UPDATABLE_FIELDS);

  const [updatedCount] = await ProductSubscription.update(data, {
    where: { member_id: memberId },
    order: [['created_at', 'DESC']], // último creado
  });

  return updatedCount > 0;
}

export async function setSkioSubcriptionId(productSubscriptionId, skio_subscription_id) {
  return updateProductSubscriptionById(productSubscriptionId, { skio_subscription_id: skio_subscription_id });
}


//DEPENDENT FUNCTIONS
export async function addDependents(productSubscriptionId, dependents = []) {
  if (!dependents.length) return [];

  const rows = dependents.map(d => ({
    product_subscription_id: productSubscriptionId,
    firstname: d.firstname,
    lastname: d.lastname,
    birthday: d.birthday,           // 'YYYY-MM-DD'
    relationship: d.relationship,   // 'Spouse' | 'Child'
    gender: d.gender,               // 'Male' | 'Female'
    address: d.address ?? null,
    state: d.state ?? null,
    zipcode: d.zipcode ?? null,
    phone: d.phone ?? null,
    email: d.email ?? null,
  }));

  return Dependent.bulkCreate(rows, { returning: true });
}