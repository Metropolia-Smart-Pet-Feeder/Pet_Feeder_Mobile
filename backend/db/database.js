const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

async function initDatabase() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
        await pool.query(statement);
    }
}

// User operations
async function createUser(username, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
    );
    return { id: result.insertId, username };
}

async function getUserByUsername(username) {
    const [rows] = await pool.query(
        'SELECT id, username, password_hash, created_at FROM users WHERE username = ?',
        [username]
    );
    return rows[0];
}

async function getUserById(id) {
    const [rows] = await pool.query(
        'SELECT id, username, created_at FROM users WHERE id = ?',
        [id]
    );
    return rows[0];
}

async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}

// Device operations
async function createDevice(deviceId, name = null) {
    const [result] = await pool.query(
        'INSERT INTO devices (device_id, name) VALUES (?, ?)',
        [deviceId, name]
    );
    return { id: result.insertId, device_id: deviceId, name };
}

async function getDeviceByDeviceId(deviceId) {
    const [rows] = await pool.query(
        'SELECT * FROM devices WHERE device_id = ?',
        [deviceId]
    );
    return rows[0];
}

async function updateDeviceName(deviceId, name) {
    await pool.query(
        'UPDATE devices SET name = ? WHERE device_id = ?',
        [name, deviceId]
    );
    return getDeviceByDeviceId(deviceId);
}

async function deleteDevice(deviceId) {
    await pool.query(
        'DELETE FROM devices WHERE device_id = ?',
        [deviceId]
    );
}

// User-Device link operations
async function linkUserToDevice(userId, deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return { error: 'Device not found' };

    // Check if already linked
    const [existing] = await pool.query(
        'SELECT id FROM user_devices WHERE user_id = ? AND device_id = ?',
        [userId, device.id]
    );
    if (existing.length > 0) {
        return { error: 'Already linked to this device' };
    }

    const userCount = await getDeviceUserCount(device.id);
    if (userCount >= device.max_users) return { error: 'Device user limit reached' };

    const [result] = await pool.query(
        'INSERT INTO user_devices (user_id, device_id) VALUES (?, ?)',
        [userId, device.id]
    );
    return { id: result.insertId, user_id: userId, device_id: device.id };
}

async function unlinkUserFromDevice(userId, deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return;

    await pool.query(
        'DELETE FROM user_devices WHERE user_id = ? AND device_id = ?',
        [userId, device.id]
    );

    const userCount = await getDeviceUserCount(device.id);
    if (userCount === 0) {
        await deleteDevice(deviceId);
        return { deviceDeleted: true };
    }

    return { deviceDeleted: false };
}

async function getDeviceUserCount(deviceDbId) {
    const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM user_devices WHERE device_id = ?',
        [deviceDbId]
    );
    return rows[0].count;
}

async function getDevicesByUser(userId) {
    const [rows] = await pool.query(
        `SELECT d.id, d.device_id, d.name, d.registered_at, ud.linked_at
         FROM devices d
         JOIN user_devices ud ON d.id = ud.device_id
         WHERE ud.user_id = ?`,
        [userId]
    );
    return rows;
}

async function getUsersByDevice(deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return [];

    const [rows] = await pool.query(
        `SELECT u.id, u.username, ud.linked_at
         FROM users u
         JOIN user_devices ud ON u.id = ud.user_id
         WHERE ud.device_id = ?`,
        [device.id]
    );
    return rows;
}

async function isUserLinkedToDevice(userId, deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return false;

    const [rows] = await pool.query(
        'SELECT id FROM user_devices WHERE user_id = ? AND device_id = ?',
        [userId, device.id]
    );
    return rows.length > 0;
}

// Cat operations
async function createCat(deviceId, rfid, name = null) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return { error: 'Device not found' };

    const [result] = await pool.query(
        'INSERT INTO cats (device_id, rfid, name) VALUES (?, ?, ?)',
        [device.id, rfid, name]
    );
    return { id: result.insertId, device_id: device.id, rfid, name };
}

async function getCatsByDevice(deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return [];

    const [rows] = await pool.query(
        'SELECT id, rfid, name, created_at FROM cats WHERE device_id = ?',
        [device.id]
    );
    return rows;
}

async function getCatByRfid(deviceId, rfid) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return null;

    const [rows] = await pool.query(
        'SELECT * FROM cats WHERE device_id = ? AND rfid = ?',
        [device.id, rfid]
    );
    return rows[0];
}

async function updateCatName(deviceId, rfid, name) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return null;

    await pool.query(
        'UPDATE cats SET name = ? WHERE device_id = ? AND rfid = ?',
        [name, device.id, rfid]
    );
    return getCatByRfid(deviceId, rfid);
}

async function deleteCat(deviceId, rfid) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return;

    await pool.query(
        'DELETE FROM cats WHERE device_id = ? AND rfid = ?',
        [device.id, rfid]
    );
}

// Schedule operations
async function setSchedules(deviceId, schedules) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return { error: 'Device not found' };

    await pool.query('DELETE FROM schedules WHERE device_id = ?', [device.id]);

    for (const schedule of schedules) {
        await pool.query(
            'INSERT INTO schedules (device_id, hour, minute, amount, enabled) VALUES (?, ?, ?, ?, ?)',
            [device.id, schedule.hour, schedule.minute, schedule.amount, schedule.enabled ?? true]
        );
    }

    return getSchedulesByDevice(deviceId);
}

async function getSchedulesByDevice(deviceId) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return [];

    const [rows] = await pool.query(
        'SELECT id, hour, minute, amount, enabled FROM schedules WHERE device_id = ?',
        [device.id]
    );
    return rows;
}

// Event operations
async function createEvent(deviceId, type, data = {}) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return { error: 'Device not found' };

    const [result] = await pool.query(
        'INSERT INTO events (device_id, type, data) VALUES (?, ?, ?)',
        [device.id, type, JSON.stringify(data)]
    );
    return { id: result.insertId, device_id: device.id, type, data };
}

async function getEventsByDevice(deviceId, limit = 100, offset = 0) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return [];

    const [rows] = await pool.query(
        'SELECT id, type, data, timestamp FROM events WHERE device_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [device.id, limit, offset]
    );
    return rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    }));
}

async function getEventsByType(deviceId, type, limit = 100, offset = 0) {
    const device = await getDeviceByDeviceId(deviceId);
    if (!device) return [];

    const [rows] = await pool.query(
        'SELECT id, type, data, timestamp FROM events WHERE device_id = ? AND type = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
        [device.id, type, limit, offset]
    );
    return rows.map(row => ({
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    }));
}

async function deleteOldEvents(daysToKeep = 15) {
    await pool.query(
        'DELETE FROM events WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
        [daysToKeep]
    );
}

module.exports = {
    pool,
    initDatabase,
    createUser,
    getUserByUsername,
    getUserById,
    verifyPassword,
    createDevice,
    getDeviceByDeviceId,
    updateDeviceName,
    deleteDevice,
    linkUserToDevice,
    unlinkUserFromDevice,
    getDeviceUserCount,
    getDevicesByUser,
    getUsersByDevice,
    isUserLinkedToDevice,
    createCat,
    getCatsByDevice,
    getCatByRfid,
    updateCatName,
    deleteCat,
    setSchedules,
    getSchedulesByDevice,
    createEvent,
    getEventsByDevice,
    getEventsByType,
    deleteOldEvents
};