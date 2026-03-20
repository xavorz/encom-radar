# === STAGE 1: Build React client ===
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# === STAGE 2: Production server ===
FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./
RUN npm install --production

# Copy server code
COPY server/ ./

# Copy built client into server's public folder
COPY --from=client-build /app/client/build ./public

# Serve static files from Express (add to index.js at runtime)
# The server already listens on PORT from env

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
