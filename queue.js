const { Queue } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});
connection.on('connect', () => {
  console.log('✅ Conectado a Redis');
});

connection.on('error', (err) => {
  console.error('❌ Error Redis:', err);
});
const downloadQueue = new Queue('mp3-download', {
  connection
});

module.exports = { downloadQueue, connection };