# Usa una imagen de Node.js
FROM node:18-slim

# Instalar Python, FFmpeg y herramientas necesarias
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar la versión más reciente de yt-dlp directamente desde el binario
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copiar archivos del proyecto
COPY package*.json ./
RUN npm install

COPY . .

# Railway usa la variable PORT
ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]