const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const auth = require('../middleware/auth');

const RECOGNITION_SERVICE_URL = process.env.RECOGNITION_SERVICE_URL || 'http://127.0.0.1:5004';

async function runRecognition(deviceId, photoId, filePath) {
    console.log(`Recognition: starting for photo ${photoId}, device ${deviceId}`);
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
        const form = new FormData();
        form.append('image', blob, 'cat.jpg');

        const res = await fetch(`${RECOGNITION_SERVICE_URL}/identify`, { method: 'POST', body: form });
        const result = await res.json();
        console.log(`Recognition: result for photo ${photoId}:`, result);

        if (!result.success || result.pet_id === 'unknown') return;

        await db.updatePhotoLabel(photoId, result.pet_id);

        const cat = await db.getRecognizedCatByLabel(deviceId, result.pet_id);
        if (cat && cat.name) {
            await db.createEvent(deviceId, 'cat_identified', {
                cat_name: cat.name,
                source: 'camera',
                label: result.pet_id,
            });
        }
    } catch (err) {
        console.error('Recognition error:', err);
    }
}

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

        // Run recognition in background after responding
        runRecognition(device_id, photo.id, req.file.path);

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