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

new Worker(
  'downloads',
  async job => {

    const outputPath = path.join(__dirname, `${job.id}.mp3`);

    return new Promise((resolve, reject) => {

      const ytdlp = spawn('yt-dlp', [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',
        '-o', outputPath,
        job.data.url
      ]);

      // 🔥 AGREGAR ESTO AQUÍ
      ytdlp.stdout.on('data', data => {
        console.log("YT-DLP STDOUT:", data.toString());
      });

      ytdlp.stderr.on('data', data => {
        console.log("YT-DLP STDERR:", data.toString());
      });

      ytdlp.on('close', code => {
        if (code === 0) {
          resolve({ file: outputPath });
        } else {
          reject(new Error('Error en yt-dlp'));
        }
      });

    });
  },
  {
    connection,
    concurrency: 3
  }
);