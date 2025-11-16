FROM node:18-alpine3.21

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy source
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
