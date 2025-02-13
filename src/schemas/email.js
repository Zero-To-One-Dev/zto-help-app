const EmailSubscriptionSchema = {
    email: {
        notEmpty: { bail: true },
        isEmail: true, 
        errorMessage: 'Invalid Email',
    },
    subscription: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Subscription',
    }
};

const EmailAddressSchema = {
    email: {
        notEmpty: { bail: true },
        isEmail: true, 
        errorMessage: 'Invalid Email',
    }
};

export { EmailSubscriptionSchema, EmailAddressSchema };