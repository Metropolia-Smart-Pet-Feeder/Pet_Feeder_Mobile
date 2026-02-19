const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
    destination: './uploads/photos',
    filename: (req, file, cb) => {
        const uniqueName = `${req.params.device_id}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Upload photo (from device)
router.post('/upload/:device_id', upload.single('photo'), async (req, res) => {
    try {
        const { device_id } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No photo uploaded' });
        }

        const photo = await db.createPhoto(device_id, req.file.filename, req.file.path);
        if (photo.error) {
            return res.status(400).json({ error: photo.error });
        }

        res.status(201).json({ message: 'Photo uploaded', photo });

    } catch (err) {
        console.error('Photo upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// List photos for a device
router.get('/device/:device_id', auth, async (req, res) => {
    try {
        const { device_id } = req.params;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const photos = await db.getPhotosByDeviceId(device_id);
        res.json(photos);

    } catch (err) {
        console.error('List photos error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get a photo file
router.get('/device/:device_id/:photo_id', auth, async (req, res) => {
    try {
        const { device_id, photo_id } = req.params;
        const userId = req.user.id;

        const hasAccess = await db.isUserLinkedToDevice(userId, device_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const photo = await db.getPhotoById(photo_id);
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        res.sendFile(path.resolve(photo.path));

    } catch (err) {
        console.error('Get photo error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;