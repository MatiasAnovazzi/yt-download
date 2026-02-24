
const { Worker } = require('bullmq');
const { connection } = require('./queue');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("🚀 Iniciando worker...");

const worker = new Worker(
  'downloads',
  async job => {

    console.log(`📥 Procesando job ${job.id}`);
    console.log("URL:", job.data.url);

    const outputPath = path.join(__dirname, `${job.id}.mp3`);

    return new Promise((resolve, reject) => {

      const ytdlp = spawn('yt-dlp', [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',
        '-o', outputPath,
        job.data.url
      ]);

      // 🔍 Logs detallados
      ytdlp.stdout.on('data', data => {
        console.log("YT-DLP STDOUT:", data.toString());
      });

      ytdlp.stderr.on('data', data => {
        console.log("YT-DLP STDERR:", data.toString());
      });

      ytdlp.on('error', err => {
        console.error("❌ Error al ejecutar yt-dlp:", err);
        reject(err);
      });

      ytdlp.on('close', code => {
        console.log(`🔚 yt-dlp terminó con código ${code}`);

        if (code === 0 && fs.existsSync(outputPath)) {
          console.log("✅ Archivo generado:", outputPath);
          resolve({ file: outputPath });
        } else {
          console.error("❌ Falló la conversión");
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

// Eventos globales del worker
worker.on('completed', job => {
  console.log(`✅ Job ${job.id} completado`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} falló:`, err.message);
});

worker.on('error', err => {
  console.error("🔥 Error crítico del worker:", err);
});

console.log("👷 Worker listo y esperando trabajos...");