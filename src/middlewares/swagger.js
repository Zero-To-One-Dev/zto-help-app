import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ZTO Helper App',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer'
        }
      }
    }
  },
  apis: ['**/routes/*.js'], // files containing annotations as above
};

const openapiSpecification = swaggerJsdoc(options);
export default openapiSpecification;