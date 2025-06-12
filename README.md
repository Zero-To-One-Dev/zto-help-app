# ZTO Help App

## Install

```bash
npm i
```

## Environment Variables

```bash
NODE_ENV='development || production'
PORT='<PORT>'
EMAIL_SENDER='<YOUR@EMAIL.SERVER>'
EMAIL_HOST='<EMAIL_SERVER>'
EMAIL_PORT='<EMAIL_PORT>'
EMAIL_USER='<EMAIL_SERVER_USER>'
EMAIL_PASSWORD='<EMAIL_SERVER_PASSWORD>'
SKIO_API_KEY='<YOUR_SKIO_API_KEY>'
REDIS_URL='redis//@localhost:6379'
PGUSER='<YOUR_POSTGRES_USER>'
PGPASSWORD='<YOUR_POSTGRES_PASSWORD>'
PGHOST='localhost'
PGPORT='5432'
PGDATABASE='<YOUR_POSTGRES_DATABASE>'
SHEET_NAME='WHERE THE INFO OF THE INFLUENCERS ARE SAVED'
PROCESS_TICKET_TAG='THE TICKETS THAT HAVE THIS TAG IS GOING TO BE PROCCESSD'
```

## Run

```bash
# Create logs folder
mkdir logs

# Development mode
npm run dev

# Production mode
npm start
```

### Note

In addition to the execution commands, it is necessary to set the `NODE_ENV` environment variable to `production` so that when `npm start` is executed, the entire server is executed in production.

## References

- [https://expressjs.com/en/advanced/best-practice-performance.html](https://expressjs.com/en/advanced/best-practice-performance.html)


