require('dotenv').config();
const express = require('express');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const catRoutes = require('./routes/cats');
const scheduleRoutes = require('./routes/schedules');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos')
const recognizedCatRoutes = require('./routes/recognized-cats')

// Initialize MQTT client (starts connection and subscribes to events)
require('./mqtt/client');

const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/cats', catRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/recognized-cats', recognizedCatRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const EVENT_RETENTION_DAYS = parseInt(process.env.EVENT_RETENTION_DAYS) || 90;
const PHOTO_RETENTION_DAYS = parseInt(process.env.PHOTO_RETENTION_DAYS) || 90;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function purgeOldData() {
    try {
        const [eventsResult] = await db.pool.query(
            'DELETE FROM events WHERE timestamp < NOW() - INTERVAL ? DAY',
            [EVENT_RETENTION_DAYS]
        );
        const [photosResult] = await db.pool.query(
            'DELETE FROM photos WHERE captured_at < NOW() - INTERVAL ? DAY',
            [PHOTO_RETENTION_DAYS]
        );
        console.log(`Purge complete: ${eventsResult.affectedRows} events, ${photosResult.affectedRows} photos removed`);
    } catch (err) {
        console.error('Purge failed:', err);
    }
}

db.initDatabase().then(() => {
    console.log('Database initialized');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    // Run once at startup, then every 24 hours
    purgeOldData();
    setInterval(purgeOldData, PURGE_INTERVAL_MS);
}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});