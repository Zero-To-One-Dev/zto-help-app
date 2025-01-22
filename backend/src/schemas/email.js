const emailSchema = {
    email: {
        notEmpty: { bail: true },
        isEmail: true, 
        errorMessage: 'Invalid Email',
    }
};

export default emailSchema;