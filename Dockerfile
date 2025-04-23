FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN mkdir -p data/uploads logs creds

COPY . .

RUN chmod +x /app/startup.sh

ENV GOOGLE_APPLICATION_CREDENTIALS=/app/creds/magiq-ai-fc9670291bfe.json

EXPOSE 8080

CMD ["/app/startup.sh"]