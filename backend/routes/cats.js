const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

router.use(auth);

// Create a new cat
router.post('/', async (req, res) => {
    try {
        const { device_id, rfid_tag, name } = req.body;
        const userId = req.user.id;

        if (!device_id || !rfid_tag || !name) {
            return res.status(400).json({ error: 'device_id, rfid_tag, and name are required' });
        }

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const cat = await db.createCat(device_id, rfid_tag, name);
        if (cat.error) {
            return res.status(400).json({ error: cat.error });
        }

        res.status(201).json({ message: 'Cat registered', cat });

    } catch (err) {
        console.error('Create cat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// List cats for a device
router.get('/device/:device_id', async (req, res) => {
    try {
        const { device_id } = req.params;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const cats = await db.getCatsByDevice(device_id);
        res.json(cats);

    } catch (err) {
        console.error('List cats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Rename a cat by RFID
router.put('/:rfid/rename', async (req, res) => {
    try {
        const { rfid } = req.params;
        const { device_id, name } = req.body;
        const userId = req.user.id;

        if (!device_id || !name) {
            return res.status(400).json({ error: 'device_id and name are required' });
        }

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const cat = await db.getCatByRfid(device_id, rfid);
        if (!cat) {
            return res.status(404).json({ error: 'Cat not found' });
        }

        const updatedCat = await db.updateCatName(cat.id, name);
        res.json({ message: 'Cat renamed', cat: updatedCat });

    } catch (err) {
        console.error('Rename cat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a cat by RFID
router.delete('/:rfid', async (req, res) => {
    try {
        const { rfid } = req.params;
        const { device_id } = req.body;
        const userId = req.user.id;

        if (!device_id) {
            return res.status(400).json({ error: 'device_id is required' });
        }

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const cat = await db.getCatByRfid(device_id, rfid);
        if (!cat) {
            return res.status(404).json({ error: 'Cat not found' });
        }

        await db.deleteCat(cat.id);
        res.json({ message: 'Cat deleted' });

    } catch (err) {
        console.error('Delete cat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;