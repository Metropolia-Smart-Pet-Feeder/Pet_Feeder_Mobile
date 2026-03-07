const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// List recognized cats for a device
router.get('/:device_id', auth, async (req, res) => {
    try {
        const { device_id } = req.params;
        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const cats = await db.getRecognizedCatsByDevice(device_id);
        res.json(cats);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Register a label with a name
router.post('/:device_id', auth, async (req, res) => {
    try {
        const { device_id } = req.params;
        const { label, name } = req.body;

        if (!label || !name) return res.status(400).json({ error: 'label and name are required' });

        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const cat = await db.createRecognizedCat(device_id, label, name);
        if (cat.error) return res.status(400).json({ error: cat.error });

        res.status(201).json(cat);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Label already registered' });
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update name or rfid link
router.put('/:device_id/:label', auth, async (req, res) => {
    try {
        const { device_id, label } = req.params;
        const { name, rfid } = req.body;

        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const cat = await db.updateRecognizedCat(device_id, label, { name, rfid });
        if (!cat) return res.status(404).json({ error: 'Not found' });

        res.json(cat);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a recognized cat
router.delete('/:device_id/:label', auth, async (req, res) => {
    try {
        const { device_id, label } = req.params;

        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        await db.deleteRecognizedCat(device_id, label);
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
