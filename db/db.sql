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

/* Creación de chatgpt_requests */
CREATE TABLE chatgpt_requests (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  request TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- EXTRA HEALTH TABLES
CREATE TYPE gender AS ENUM('Male', 'Female');
CREATE TYPE phone_device AS ENUM('Android', 'Apple');
CREATE TYPE status_member AS ENUM('CREATED', 'ENROLLED', 'ON_HOLD', 'CANCEL');
CREATE TYPE status_product AS ENUM('ACTIVE', 'ON_HOLD', 'CANCEL');
CREATE TYPE relationship AS ENUM('Spouse', 'Child');

CREATE TABLE "members" (
  "id" integer PRIMARY KEY,
  "extrahealth_id" integer UNIQUE,
  "customer_id" integer UNIQUE,
  "status" status_member,
  "firstname" varchar,
  "lastname" varchar,
  "birthday" timestamp,
  "gender" gender,
  "phone_number" varchar,
  "phone_device" phone_device,
  "email" varchar,
  "address" varchar,
  "state" varchar,
  "zipcode" varchar,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "product_subscriptions" (
  "id" integer PRIMARY KEY,
  "member_id" integer,
  "skio_subscription_id" varchar,
  "contract_id" integer UNIQUE,
  "pdid" integer,
  "dtEffective" timestamp,
  "bPaid" boolean,
  "dtBilling" timestamp,
  "dtRecurring" timestamp,
  "dtCancelled" timestamp,
  "status" status_product,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "dependents" (
  "id" integer PRIMARY KEY,
  "product_subscription_id" integer,
  "firstname" varchar,
  "lastname" varchar,
  "birthday" date,
  "relationship" relationship,
  "gender" gender,
  "address" varchar,
  "state" varchar,
  "zipcode" varchar,
  "phone" varchar,
  "email" varchar,
  "created_at" timestamp,
  "updated_at" timestamp
);

COMMENT ON COLUMN "members"."status" IS 'CREATED, ENROLLED, ON_HOLD, CANCEL';
COMMENT ON COLUMN "members"."gender" IS 'Male, Female';
COMMENT ON COLUMN "members"."phone_device" IS 'Android, Apple';
COMMENT ON COLUMN "product_subscriptions"."dtEffective" IS 'Fecha Activación';
COMMENT ON COLUMN "product_subscriptions"."dtBilling" IS 'Fecha de pago';
COMMENT ON COLUMN "product_subscriptions"."dtRecurring" IS 'Fecha de proximo pago';
COMMENT ON COLUMN "product_subscriptions"."dtCancelled" IS 'Fecha de cancelacion';
COMMENT ON COLUMN "product_subscriptions"."status" IS 'ACTIVE, ON_HOLD, CANCEL';
COMMENT ON COLUMN "dependents"."relationship" IS 'Spouse, Child';
COMMENT ON COLUMN "dependents"."gender" IS 'Male, Female';
COMMENT ON COLUMN "dependents"."address" IS 'nullable';
COMMENT ON COLUMN "dependents"."state" IS 'nullable';
COMMENT ON COLUMN "dependents"."zipcode" IS 'nullable';
COMMENT ON COLUMN "dependents"."phone" IS 'nullable';
COMMENT ON COLUMN "dependents"."email" IS 'nullable';

ALTER TABLE "dependents" ADD FOREIGN KEY ("product_subscription_id") REFERENCES "product_subscriptions" ("id");
ALTER TABLE "product_subscriptions" ADD FOREIGN KEY ("member_id") REFERENCES "members" ("id");
/* Inserción de datos de prueba para la tabla tokens */
-- INSERT INTO tokens (shop_alias, email, token, created_at, expire_at, metadata)
-- VALUES ('123456', 'test@gmail.com', '123456', '2021-01-01 00:00:00', '2021-01-01 00:05:00', '{"subscription": "1234-5678-9012-3456"}');

/* Inserción de datos de prueba para la tabla draft_orders */
-- INSERT INTO draft_orders (shop_alias, draft_order, subscription) VALUES ('HS', '#D876', '1234-5678');

/* Inserción de datos de prueba para la tabla app_tokens */
-- INSERT INTO app_tokens (name_app, hash_api_token, status, due_date, suffix_api_token)
-- VALUES ('SHOPIFY_HS', '', 'ACTIVE', '2035-01-01', '');
