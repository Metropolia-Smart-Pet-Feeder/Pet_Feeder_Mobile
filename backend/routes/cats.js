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

        const cats = await db.getCatsByDeviceId(device_id);
        res.json(cats);

    } catch (err) {
        console.error('List cats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Rename a cat
router.put('/:cat_id/rename', async (req, res) => {
    try {
        const { cat_id } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Get cat to find its device
        const cat = await db.getCatById(cat_id);
        if (!cat) {
            return res.status(404).json({ error: 'Cat not found' });
        }

        // Verify user has access to this cat's device
        const device = await db.getDeviceById(cat.device_id);
        const hasAccess = await db.isUserLinkedToDevice(userId, device.device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updatedCat = await db.updateCatName(cat_id, name);
        res.json({ message: 'Cat renamed', cat: updatedCat });

    } catch (err) {
        console.error('Rename cat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a cat
router.delete('/:cat_id', async (req, res) => {
    try {
        const { cat_id } = req.params;
        const userId = req.user.id;

        const cat = await db.getCatById(cat_id);
        if (!cat) {
            return res.status(404).json({ error: 'Cat not found' });
        }

        const device = await db.getDeviceById(cat.device_id);
        const hasAccess = await db.isUserLinkedToDevice(userId, device.device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.deleteCat(cat_id);
        res.json({ message: 'Cat deleted' });

    } catch (err) {
        console.error('Delete cat error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;