const { Worker } = require('bullmq');
const Redis = require('ioredis');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
console.log("REDIS_URL =", process.env.REDIS_URL);
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});
connection.on('connect', () => {
  console.log("✅ Conectado a Redis Cloud");
});

connection.on('error', (err) => {
  console.error("❌ Error Redis:", err);
});
const TEMP_DIR = path.resolve(__dirname, 'temp');

new Worker('mp3-download', async job => {

  const videoUrl = job.data.url;

  let rutaFinalAbsoluta = "";

  const args = [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--print', 'after_move:filepath',
    '--no-cache-dir',
    '-o', path.join(TEMP_DIR, '%(title)s.%(ext)s'),
    videoUrl
  ];

  return new Promise((resolve, reject) => {

    const processSpawn = spawn('yt-dlp', args);

    processSpawn.stdout.on('data', (data) => {
      const lineas = data.toString().split('\n');
      lineas.forEach(linea => {
        const l = linea.trim();
        if (!l) return;
        if (l.includes(TEMP_DIR)) {
          rutaFinalAbsoluta = l;
        }
      });
    });

    processSpawn.on('close', (code) => {

      if (code === 0 && rutaFinalAbsoluta && fs.existsSync(rutaFinalAbsoluta)) {

        const nombreArchivo = path.basename(rutaFinalAbsoluta);

        console.log("✅ Archivo generado:", nombreArchivo);

        // 🔥 ESTA ES LA PARTE IMPORTANTE
        resolve({
          filename: nombreArchivo
        });

      } else {
        reject(new Error("Error al procesar descarga"));
      }

    });

  });

}, {
  connection,
  concurrency: 5
});