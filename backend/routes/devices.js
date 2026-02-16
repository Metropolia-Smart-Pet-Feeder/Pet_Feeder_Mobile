const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

// Register/link a device to user
router.post('/register', async (req, res) => {
    try {
        const { device_id } = req.body;
        const userId = req.user.id;

        if (!device_id) {
            return res.status(400).json({ error: 'device_id is required' });
        }

        let device = await db.getDeviceByDeviceId(device_id);
        if (!device) {
            device = await db.createDevice(device_id);
        }

        const link = await db.linkUserToDevice(userId, device_id);
        if (link.error) {
            return res.status(400).json({ error: link.error });
        }

        res.status(201).json({ message: 'Device registered', device });

    } catch (err) {
        console.error('Device register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// List user's devices
router.get('/', async (req, res) => {
    try {
        const devices = await db.getDevicesByUser(req.user.id);
        res.json(devices);
    } catch (err) {
        console.error('List devices error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Rename a device
router.put('/:device_id/rename', async (req, res) => {
    try {
        const { device_id } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const device = await db.updateDeviceName(device_id, name);
        res.json({ message: 'Device renamed', device });

    } catch (err) {
        console.error('Rename device error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unlink device from user
router.delete('/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const device = await db.getDeviceByDeviceId(device_id);
        const result = await db.unlinkUserFromDevice(userId, device.id);
        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ message: 'Device unlinked', deviceDeleted: result.deviceDeleted });

    } catch (err) {
        console.error('Unlink device error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;