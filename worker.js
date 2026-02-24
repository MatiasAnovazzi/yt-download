
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("🚀 Iniciando worker...");

new Worker(
  'downloads',
  async job => {

    console.log(`📥 Procesando job ${job.id}`);

    const outputTemplate = `/tmp/${job.id}-%(title)s.%(ext)s`;
    const cookiesPath = '/tmp/cookies.txt';

    if (process.env.COOKIES_CONTENT) {
      require('fs').writeFileSync(cookiesPath, process.env.COOKIES_CONTENT);
    }
    return new Promise((resolve, reject) => {

      const ytdlp = spawn('yt-dlp', [
        job.data.url,

        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',

        '--embed-metadata',
        '--embed-thumbnail',
        '--add-metadata',

        '--no-playlist',

        '--cookies', cookiesPath,

        '--user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',

        '-o', outputTemplate
      ]);

      ytdlp.stderr.on('data', data => {
        console.log("YT-DLP:", data.toString());
      });

      ytdlp.on('close', code => {

        if (code !== 0) {
          return reject(new Error("yt-dlp falló"));
        }

        // 🔍 buscar el archivo generado
        const files = fs.readdirSync('/tmp');
        const file = files.find(f => f.startsWith(`${job.id}-`) && f.endsWith('.mp3'));

        if (!file) {
          return reject(new Error("No se encontró el archivo generado"));
        }

        const fullPath = path.join('/tmp', file);

        console.log("✅ Archivo listo:", fullPath);

        resolve({
          file: fullPath,
          filename: file
        });

      });

    });
  },
  {
    connection,
    concurrency: 3
  }
);

console.log("👷 Worker listo");