import { checkSchema, validationResult } from 'express-validator';
const messageValidation = validationResult.withDefaults({ formatter: error => error.msg });

// Custom Error Handler Function with express-validator functions
const handleError = (schema) => {
  return async (req, res, next) => {
    await checkSchema(schema).run(req);
    const error = messageValidation(req).array()[0];
    if (error) { res.status(500).json({ message: error });
    } else { next(); }
  }
};

export default handleError;