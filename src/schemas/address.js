const AddressSchema = {
    email: {
        notEmpty: { bail: true },
        isEmail: true,
        errorMessage: 'Invalid Email',
    },
    token: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Token',
    },
    id: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Order',
    },
    address1: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Address 1',
    },
    address2: {
        optional: true,
        customSanitizer: {
            options: (address2) => address2 === '' ? null : address2
        }
    },
    provinceCode: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Province Code',
    },
    province: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Province',
    },
    city: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid City',
    },
    zip: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid ZIP',
    },

};

export { AddressSchema };