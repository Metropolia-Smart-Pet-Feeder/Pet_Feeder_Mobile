const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

// Get events for a device
router.get('/device/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;
        const { limit, offset } = req.query;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const events = await db.getEventsByDevice(
            device_id,
            parseInt(limit) || 100,
            parseInt(offset) || 0
        );

        res.json(events);

    } catch (err) {
        console.error('Get events error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;