const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');
const mqtt = require('../mqtt/client');

router.use(auth);

// Get schedules for a device
router.get('/device/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const schedules = await db.getSchedulesByDevice(device_id);
        res.json(schedules);

    } catch (err) {
        console.error('Get schedules error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Set schedules for a device (replaces all existing)
router.put('/device/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;
        const { schedules } = req.body;
        const userId = req.user.id;

        if (!Array.isArray(schedules)) {
            return res.status(400).json({ error: 'schedules must be an array' });
        }

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate each schedule
        for (const schedule of schedules) {
            if (schedule.hour === undefined || schedule.minute === undefined || schedule.amount === undefined) {
                return res.status(400).json({ error: 'Each schedule requires hour, minute, and amount' });
            }
        }

        // Save to database
        const savedSchedules = await db.setSchedules(device_id, schedules);
        if (savedSchedules.error) {
            return res.status(400).json({ error: savedSchedules.error });
        }

        // Send to device via MQTT
        const topic = `petfeeder/${device_id}/command`;
        const payload = JSON.stringify({
            type: 'schedule',
            schedules: savedSchedules
        });
        mqtt.publish(topic, payload);

        res.json({ message: 'Schedules updated', schedules: savedSchedules });

    } catch (err) {
        console.error('Set schedules error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;