FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy source
COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
