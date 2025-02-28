export const SubscriptionSchema = {
    email: {
        notEmpty: { bail: true },
        isEmail: true, 
        errorMessage: 'Email or Token Not Found'
    },
    token: {
        notEmpty: { bail: true },
        isLength: { options: { min: 6, max: 6 }},
        errorMessage: 'Email or Token Not Found'
    },
    subscription: {
        notEmpty: { bail: true },
        errorMessage: 'Email or Token Not Found'
    }
};
