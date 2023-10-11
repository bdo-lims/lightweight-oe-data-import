FROM  node:18-alpine

WORKDIR /app

COPY . .

RUN npm i

CMD [ "node", "./pg_notify.js" ]

