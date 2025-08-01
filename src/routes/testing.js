import { Router } from "express";
import PostgresRequestRepository from "../repositories/postgresrequest.repository.js";

const router = Router();
const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'PUT'];

function sanitizeHeaders(headers) {
  const excluded = ['host', 'content-length', 'connection'];
  const sanitized = {};
  for (const key in headers) {
    if (!excluded.includes(key.toLowerCase())) {
      sanitized[key] = headers[key];
    }
  }
  return sanitized;
}

const serviceRequest = async (req, res) => {
  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const requestRepository = new PostgresRequestRepository();
  const method = req.method;
  const headers = sanitizeHeaders(req.headers);
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? req.body : null;
  const url = 'https://servicioexterno.com/webhook';

  let externalStatus = null;
  let externalResponseBody = null;

  try {

    /*
    // Consyultamos el servicio externo
    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers, // Puedes filtrar si es necesario
      },
      body: JSON.stringify(body),
    }

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const externalResponse = await fetch(url, fetchOptions);

    // Guardamos la respuesta
    externalStatus = externalResponse.status;
    externalResponseBody = await externalResponse.text();
    */
    externalStatus = 200;
    externalResponseBody = JSON.stringify({ message: 'Ok!!' });

    // Guardamos en la DB
    await requestRepository.saveRequest('save-response', headers, body ? body : '""', externalStatus, externalResponseBody ? externalResponseBody : "");

    console.log('Devolviendo respuesta:', externalStatus, externalResponseBody);
    return res.status(externalStatus).send(externalResponseBody);
  } catch (error) {
    console.error('Error al procesar el webhook:', error);

    // Intentamos guardar el error también en la base de datos
    try {
      await requestRepository.saveRequest('save-response', headers, body ? body : '""', 500, JSON.stringify({ error: error.message }) );
    } catch (dbError) {
      console.error('Error al guardar en DB después del fallo:', dbError);
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

router.all("/test/save-request", serviceRequest);

export default router