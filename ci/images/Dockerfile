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

CMD ["sh", "-c", "node api/index.js --port ${SERVER_PORT}"]