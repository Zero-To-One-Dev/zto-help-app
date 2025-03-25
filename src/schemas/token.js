export const TokenSchema = {
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
    cancelSessionId: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid cancel session id'
    }
};
