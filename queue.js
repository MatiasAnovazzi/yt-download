const { Queue } = require('bullmq');
const IORedis = require('ioredis');

if (!process.env.REDIS_URL) {
  throw new Error("❌ REDIS_URL no está definida");
}

// Crear cliente Redis usando URL completa
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // 🔥 necesario para BullMQ
  enableReadyCheck: false
});

// Crear cola
const downloadQueue = new Queue('downloads', {
  connection
});

console.log("✅ Conectado a Redis Cloud");

module.exports = { downloadQueue, connection };