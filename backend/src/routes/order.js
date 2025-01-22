import { Router } from "express";
import handleError from '../middlewares/errorHandle.js';

const router = Router();

/**
 *  @openapi
 *  /order/validate:
 *    post:
 *      tags:
 *        - Order
 *      description: Validate Order
 *      requestBody:
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                email:
 *                  type: string
 *                token:
 *                  type: string
 *                order:
 *                  type: string
 *      responses:
 *        200:
 *          description: Returns JSON message
 */
router.post('/validate', handleError(tokenSchema), (req, res) => {
    try {
        const { email, token } = req.body;

        // Se debe validar si el correo existe en SKIO

        // Aquí se debe enviar el JWT
        res.json({message: `Hello World ${token}`})
    } catch (err) {
        logger.error(err);
        res.status(500).json({message: err})
    }
})

export default router;