export const SubscriptionsSchema = {
  email: {
    notEmpty: { bail: true },
    errorMessage: 'Email Not Found'
  },
  sku: {
    notEmpty: { bail: true },
    errorMessage: 'Sku Not Found'
  },
  shopAlias: {
    notEmpty: { bail: true },
    errorMessage: 'Shop Not Found'
  }
}