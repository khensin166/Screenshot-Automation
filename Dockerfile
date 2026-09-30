# Menggunakan Node.js dengan OS Alpine Linux yang super ringan
FROM node:18-alpine

# Menginstal Chromium dan paket Font/Grafis yang dibutuhkan Alpine
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Memberitahu Puppeteer agar tidak mengunduh Chrome secara mandiri
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Mengarahkan eksekusi ke Chromium yang diinstal dari Alpine
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8081

CMD ["node", "server.js"]
