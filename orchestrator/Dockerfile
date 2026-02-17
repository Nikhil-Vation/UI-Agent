FROM node:20-slim

# Install Playwright system deps
RUN npx playwright install-deps chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Install Playwright browser
RUN npx playwright install chromium

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
