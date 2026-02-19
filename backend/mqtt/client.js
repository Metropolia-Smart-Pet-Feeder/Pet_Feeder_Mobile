const mqtt = require('mqtt');
const db = require('../db/database');

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
});

client.on('connect', () => {
    console.log('MQTT client connected');
    // Subscribe to all device events using wildcard
    client.subscribe('petfeeder/+/event', (err) => {
        if (err) {
            console.error('MQTT subscribe error:', err);
        }
    });
});

client.on('message', async (topic, message) => {
    try {
        // Extract device_id from topic: petfeeder/{device_id}/event
        const parts = topic.split('/');
        const deviceId = parts[1];

        const payload = JSON.parse(message.toString());

        // For cat_identified events, resolve the cat name from the rfid
        if (payload.type === 'cat_identified' && payload.rfid) {
            console.log(`[cat_identified] deviceId="${deviceId}" rfid="${payload.rfid}"`);
            const cat = await db.getCatByRfid(deviceId, payload.rfid);
            console.log(`[cat_identified] lookup result:`, cat);
            payload.cat_name = cat ? cat.name : 'Unknown cat';
        }

        // Log the event to database
        await db.createEvent(deviceId, payload.type, payload);

    } catch (err) {
        console.error('Error processing MQTT message:', err);
    }
});

client.on('error', (err) => {
    console.error('MQTT client error:', err);
});

module.exports = client;