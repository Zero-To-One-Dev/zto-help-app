const emailSchema = {
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

export default emailSchema;