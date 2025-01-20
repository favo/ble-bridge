import bleno from "bleno";
import { Server } from "socket.io";
import http from "http";

const SERVICE_UUID = "89496822200000000000000000000000";
const WRITE_CHARACTERISTIC_UUID = "89496822201000000000000000000000";
const NOTIFY_CHARACTERISTIC_UUID = "89496822202000000000000000000000";

const bleCallbacks = {
    writeCallback: (data) => {},
    notifyCallback: (isSubscribed, maxValueSize, callback) => {},
};

const writeCharacteristic = new bleno.Characteristic({
    uuid: WRITE_CHARACTERISTIC_UUID,
    properties: ["write"],
    onWriteRequest: (data, _offset, _withoutResponse, callback) => {
        console.log("onWriteRequest write request: " + data.toString("utf-8"));
        bleCallbacks.writeCallback(data);
        callback(bleno.Characteristic.RESULT_SUCCESS);
    },
});

const notifyCharacteristic = new bleno.Characteristic({
    uuid: NOTIFY_CHARACTERISTIC_UUID,
    properties: ["notify"],
    onSubscribe: (maxValueSize, updateValueCallback) => {
        console.log("notifyNetworkConnectionCharacteristic - onSubscribe");
        bleCallbacks.notifyCallback(true, maxValueSize, updateValueCallback);
    },
    onUnsubscribe: () => {
        console.log("notifyNetworkConnectionCharacteristic - onUnsubscribe");
        bleCallbacks.notifyCallback(false, 0, null);
    },
});

const configurationService = new bleno.PrimaryService({
    uuid: SERVICE_UUID,
    characteristics: [writeCharacteristic, notifyCharacteristic],
});


const io = new Server();

let blenoReady = false;

let nofifyStatus;
let notifyMaxValueSize;
let notifyCallback;

bleno.on("stateChange", (state) => {
    console.log("on -> stateChange: " + state);
    if (state === "poweredOn") {
        blenoReady = true;
    }
});

bleno.on("advertisingStart", (err) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log("advertising...");
    bleno.setServices([configurationService]);
});

bleno.on("accept", () => {
    io.sockets.emit("device-accepted");
});

bleno.on("disconnect", () => {
    io.sockets.emit("device-disconnected");
});

io.on("connection", (socket) => {
    socket.on("ble-enable", (data) => {
        if (blenoReady) {
            const deviceName = "rpi";
            const bluetooth_id = data.bluetooth_id;
            const firstTimeBuffer = Buffer.from([data.firstTime ? 1 : 0]);

            const advertisementData = Buffer.concat([
                Buffer.from([0x02, 0x01, 0x06]),
                Buffer.from([deviceName.length + 1, 0x09]),
                Buffer.from(deviceName),
                Buffer.from([bluetooth_id.length + 1 + 1, 0xff]),
                Buffer.from(bluetooth_id),
                firstTimeBuffer,
            ]);

            const scanResponseData = Buffer.concat([
                Buffer.from([0x11, 0x07]), // Length and type for complete list of 128-bit Service UUIDs
                Buffer.from(
                    SERVICE_UUID.match(/.{1,2}/g)
                        .reverse()
                        .join(""),
                    "hex"
                ), // Service UUID in little-endian format
            ]);

            bleno.startAdvertisingWithEIRData(
                advertisementData,
                scanResponseData,
                (err) => {
                    if (err) {
                        console.error("Failed to start advertising:", err);
                    } else {
                        console.log("Advertising started successfully");
                        io.emit("ble-enabled");
                    }
                }
            );
        }
    });

    socket.on("ble-disable", () => {
        bleno.stopAdvertising();
        io.emit("ble-disabled");
    });

    socket.on("notify", (data) => {
        if (nofifyStatus && notifyCallback != null) {
            sendDataInChunks(data, notifyCallback, notifyMaxValueSize);
        }
    });
});

function sendDataInChunks(data, callback, chunkSize) {
    const payloadSize = chunkSize - 3
    const jsonData = JSON.stringify(data.data);
    const key = data.key;
    const totalPackets = Math.ceil(jsonData.length / payloadSize); // Calculate total packets

    let offset = 0;
    let packetID = 0;

    const sendNextChunk = () => {
        if (offset >= jsonData.length) return;

        // Create the chunk payload
        const payload = Buffer.from(jsonData.slice(offset, offset + payloadSize));

        // Create a buffer for the chunk with the first three bytes reserved
        const chunk = Buffer.alloc(payload.length + 3);

        // Add the metadata
        chunk[0] = key; // First byte: data.key
        chunk[1] = packetID; // Second byte: packet ID
        chunk[2] = totalPackets; // Third byte: total packets

        // Add the actual payload
        payload.copy(chunk, 3);

        // Call the callback with the chunk
        if (callback) {
            callback(chunk);
        }

        // Update the offset and packet ID
        offset += payloadSize;
        packetID++;

        // Send the next chunk after a delay
        setTimeout(sendNextChunk, 20);
    };

    sendNextChunk();
}

bleCallbacks.writeCallback = (data) => {
    io.sockets.emit("write", data);
};

bleCallbacks.notifyCallback = (status, maxValueSize, callback) => {
    nofifyStatus = status;
    notifyMaxValueSize = maxValueSize;
    notifyCallback = callback;
    io.sockets.emit("notify");
};

const httpServer = http.createServer();
io.attach(httpServer);
httpServer.listen(3333, "127.0.0.1");