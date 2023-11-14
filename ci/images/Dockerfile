ARG NODE_VERSION=18.16
ARG NODE_ENV=production

FROM node:${NODE_VERSION}-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm i

# Copy source
COPY . .

# Build and cleanup
ENV NODE_ENV=$NODE_ENV
RUN npm prune

ENV SERVER_PORT=3000
EXPOSE $SERVER_PORT

RUN apk update \
  && apk add --no-cache openssl ca-certificates

RUN echo "generating certificates..." \
  && mkdir -p .certs \
  && openssl genrsa -out .certs/key.pem \
  && openssl req -new -key .certs/key.pem -out .certs/csr.pem -subj "/C=NO/ST=Olso/L=Olso/O=WAU IO/OU=devops/CN=*.ela.city" \
  && openssl x509 -req -days 365 -in .certs/csr.pem -signkey .certs/key.pem -out .certs/cert.pem

CMD ["sh", "-c", "node api/index.js --port ${SERVER_PORT} --ssl-key .certs/key.pem --ssl-cert .certs/cert.pem"]