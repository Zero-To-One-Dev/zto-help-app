/* Creación de tabla tokens */
CREATE TABLE tokens (
    id SERIAL PRIMARY KEY,
    shop_alias TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP::TIMESTAMP,
    expire_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes')::TIMESTAMP,
    metadata JSON,
    CONSTRAINT unique_shop_email UNIQUE (shop_alias, email)
);

/* Crear tipo de draft_order_status */
CREATE TYPE draft_order_status AS ENUM('UNPROCESSED', 'PROCESSING', 'COMPLETED', 'ERROR');

/* Creación de tabla draft_orders */
CREATE TABLE draft_orders(
    id SERIAL PRIMARY KEY,
    shop_alias VARCHAR NOT NULL,
    draft_order VARCHAR NOT NULL,
    subscription VARCHAR NOT NULL,
    payment_due TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '3 days')::TIMESTAMP,
    status draft_order_status DEFAULT 'UNPROCESSED',
    message VARCHAR NULL,
    cancel_session_id VARCHAR NOT NULL
);

/* Creación de ENUM para status */
CREATE TYPE token_status AS ENUM ('ACTIVE', 'INACTIVE'); 

/* Creación de tabla app_tokens */
CREATE TABLE app_tokens(
    id SERIAL PRIMARY KEY,
    name_app VARCHAR NOT NULL UNIQUE,
    hash_api_token VARCHAR NOT NULL,
    status token_status NOT NULL,
    due_date TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 years')::TIMESTAMP,
    suffix_api_token VARCHAR(4)
);

/* Crear tipo de ticket_status */
CREATE TYPE ticket_status AS ENUM('UNPROCESSED', 'PROCESSING', 'COMPLETED', 'ERROR');

/* Creación de tabla tickets */
CREATE TABLE gorgias_tickets (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL,
  status ticket_status DEFAULT 'UNPROCESSED',
  retries INTEGER DEFAULT 0
);


/* Inserción de datos de prueba para la tabla tokens */
-- INSERT INTO tokens (shop_alias, email, token, created_at, expire_at, metadata)
-- VALUES ('123456', 'test@gmail.com', '123456', '2021-01-01 00:00:00', '2021-01-01 00:05:00', '{"subscription": "1234-5678-9012-3456"}');

/* Inserción de datos de prueba para la tabla draft_orders */
-- INSERT INTO draft_orders (shop_alias, draft_order, subscription) VALUES ('HS', '#D876', '1234-5678');

/* Inserción de datos de prueba para la tabla app_tokens */
-- INSERT INTO app_tokens (name_app, hash_api_token, status, due_date, suffix_api_token)
-- VALUES ('SHOPIFY_HS', '', 'ACTIVE', '2035-01-01', '');
