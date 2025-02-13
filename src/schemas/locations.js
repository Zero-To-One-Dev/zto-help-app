const ProvinceCountrySchema = {
    country: {
        notEmpty: { bail: true },
        errorMessage: 'Invalid Country',
    }
};

export { ProvinceCountrySchema };
