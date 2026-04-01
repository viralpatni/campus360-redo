FROM node:20-alpine

WORKDIR /app

COPY package.json /app/package.json
RUN npm install --omit=dev

COPY ws-server.js /app/ws-server.js

ENV NODE_ENV=production

EXPOSE 8082

CMD ["npm", "start"]