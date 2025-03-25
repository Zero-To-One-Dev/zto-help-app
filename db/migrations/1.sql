/* Crear tipo de draft_order_status */
CREATE TYPE draft_order_status AS ENUM('UNPROCESSED', 'PROCESSING', 'COMPLETED', 'ERROR');

/* Agregar columna status */
ALTER TABLE draft_orders ADD COLUMN status draft_order_status DEFAULT 'UNPROCESSED';

/* Agregar columna message */
ALTER TABLE draft_orders ADD COLUMN message VARCHAR NULL;

/* Agregar columna retries */
ALTER TABLE draft_orders ADD COLUMN retries INTEGER NULL;

/* Agregar columna de cancel_session_id a la tabla draft_orders */
ALTER TABLE draft_orders ADD COLUMN cancel_session_id VARCHAR NULL;
