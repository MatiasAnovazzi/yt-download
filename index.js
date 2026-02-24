require('./worker');
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { downloadQueue } = require('./queue');
const app = express();
// Railway asigna el puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

const archivosParaDescargar = new Map();
const TEMP_DIR = path.resolve(__dirname, 'temp');
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Función para preparar las cookies antes de cada descarga
const prepararCookies = () => {
    if (process.env.COOKIES_CONTENT) {
        fs.writeFileSync(COOKIES_PATH, process.env.COOKIES_CONTENT);
        console.log("🍪 Cookies actualizadas desde variable de entorno.");
    } else {
        console.log("⚠️ No se encontró la variable COOKIES_CONTENT.");
    }
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status-mp3', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send("URL requerida");

    try {
        const job = await downloadQueue.add('download', {
            url: videoUrl
        });

        res.json({ jobId: job.id });

    } catch (err) {
        console.error("Error creando job:", err);
        res.status(500).send("Error interno");
    }
});

app.get('/job-status/:id', async (req, res) => {
    try {
        const job = await downloadQueue.getJob(req.params.id);

        if (!job) {
            return res.status(404).json({ state: 'not_found' });
        }

        const state = await job.getState();

        res.json({ state });

    } catch (err) {
        console.error("Error consultando estado:", err);
        res.status(500).send("Error interno");
    }
});

app.get('/descargar-archivo/:id', async (req, res) => {
  const job = await downloadQueue.getJob(req.params.id);
  if (!job) return res.status(404).send('No encontrado');

  const result = job.returnvalue;

  if (!result?.file) {
    return res.status(404).send('Archivo no listo');
  }

  const fs = require('fs');

  if (!fs.existsSync(result.file)) {
    return res.status(404).send('Archivo no encontrado');
  }

  res.download(result.file, err => {
    if (!err) {
      fs.unlinkSync(result.file);
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});