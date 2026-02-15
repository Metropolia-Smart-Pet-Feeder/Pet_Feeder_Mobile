require('dotenv').config();
const express = require('express');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const catRoutes = require('./routes/cats');
const scheduleRoutes = require('./routes/schedules');
const eventRoutes = require('./routes/events');

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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

db.initDatabase().then(() => {
    console.log('Database initialized');
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
});