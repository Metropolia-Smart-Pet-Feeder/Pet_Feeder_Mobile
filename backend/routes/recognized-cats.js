const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// Get recognized cat linked to a specific RFID
router.get('/:device_id/by-rfid/:rfid', auth, async (req, res) => {
    try {
        const { device_id, rfid } = req.params;
        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const cat = await db.getRecognizedCatByRfid(device_id, rfid);
        res.json(cat || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Unlink rfid from a label
router.put('/:device_id/:label/unlink', auth, async (req, res) => {
    try {
        const { device_id, label } = req.params;
        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        await db.unlinkRecognizedCatByLabel(device_id, label);
        res.json({ message: 'Unlinked' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

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

// Upsert name + rfid link (creates row if not exists)
router.put('/:device_id/:label', auth, async (req, res) => {
    try {
        const { device_id, label } = req.params;
        const { name, rfid } = req.body;

        if (!name || !rfid) return res.status(400).json({ error: 'name and rfid are required' });

        const hasAccess = await db.isUserLinkedToDevice(req.user.id, device_id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const cat = await db.upsertRecognizedCat(device_id, label, name, rfid);
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
