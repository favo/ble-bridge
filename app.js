const bleno = require("@stoprocent/bleno");
const { Server } = require("socket.io");

const SERVICE_UUID = "89496822200000000000000000000000";
const WRITE_CHARACTERISTIC_UUID = "89496822201000000000000000000000";
const NOTIFY_CHARACTERISTIC_UUID = "89496822202000000000000000000000";

const EVENT_WRITE = "write";
const EVENT_BLE_ENABLED = "ble-enabled";
const EVENT_DEVICE_ACCEPTED = "device-accepted";
const EVENT_DEVICE_DISCONNECTED = "device-disconnected";

const SOCKET_EVENT_BLE_ENABLE = "ble-enable";
const SOCKET_EVENT_NOTIFY = "notify";

const io = new Server();

let notifyMaxValueSize = 0;
let notifyCallback;

const configurationService = new bleno.PrimaryService({
    uuid: SERVICE_UUID,
    characteristics: [

        // receives commands
        new bleno.Characteristic({
            uuid: WRITE_CHARACTERISTIC_UUID,
            properties: ["write"],

            onWriteRequest: (data, _offset, _withoutResponse, callback) => {
                console.log("onWriteRequest write request: " + data.toString("utf-8"));
                io.sockets.emit(EVENT_WRITE, data);
                callback(bleno.Characteristic.RESULT_SUCCESS);
            }
        }),

        // sends data
        new bleno.Characteristic({
            uuid: NOTIFY_CHARACTERISTIC_UUID,
            properties: ["notify"],

            onSubscribe: (maxValueSize, updateValueCallback) => {
                console.log("notifyNetworkConnectionCharacteristic - onSubscribe");
                notifyMaxValueSize = maxValueSize;
                notifyCallback = updateValueCallback;
            },
            onUnsubscribe: () => {
                console.log("notifyNetworkConnectionCharacteristic - onUnsubscribe");
                notifyMaxValueSize = 0;
                notifyCallback = undefined;
            }
        })]
});

bleno.on("stateChange", (state) => {
    console.log("on -> stateChange: " + state);

    if (state === "poweredOn") {
        console.log("opening socket...")
        io.listen(3333, { hostname: "127.0.0.1" });
    }
    else {
        console.log("closing socket...")
        io.close()
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
    io.sockets.emit(EVENT_DEVICE_ACCEPTED);
});

bleno.on("disconnect", () => {
    notifyMaxValueSize = 0;
    notifyCallback = undefined;

    io.sockets.emit(EVENT_DEVICE_DISCONNECTED);
});

io.on("connection", (socket) => {
    socket.on(SOCKET_EVENT_BLE_ENABLE, (data) => {
        bleno.stopAdvertising();

        const deviceName = "rpi";
        const bluetooth_id = data.bluetooth_id;

        const advertisementData = Buffer.concat([
            Buffer.from([0x02, 0x01, 0x06]),
            Buffer.from([deviceName.length + 1, 0x09]),
            Buffer.from(deviceName),
            Buffer.from([bluetooth_id.length + 1 + 1, 0xff]),
            Buffer.from(bluetooth_id),
            Buffer.from([data.firstTime ? 1 : 0])
        ]);

        const scanResponseData = Buffer.concat([
            Buffer.from([0x11, 0x07]), // Length and type for complete list of 128-bit Service UUIDs
            Buffer.from(
                SERVICE_UUID.match(/.{1,2}/g)
                    .reverse()
                    .join(""),
                "hex"
            ) // Service UUID in little-endian format
        ]);

        bleno.startAdvertisingWithEIRData(
            advertisementData,
            scanResponseData,
            (err) => {
                if (err) {
                    console.error("Failed to start advertising:", err);
                } else {
                    console.log("Advertising started successfully");
                    io.emit(EVENT_BLE_ENABLED);
                }
            }
        );
    });

    socket.on(SOCKET_EVENT_NOTIFY, (data) => {
        sendDataInChunks(data);
    });
});

function sendDataInChunks(data) {
    if (notifyCallback && notifyMaxValueSize > 3) {
        const payloadSize = notifyMaxValueSize - 3;
        const jsonData = JSON.stringify(data.data);
        const key = data.key;
        const total = jsonData.length;
        const totalPackets = Math.ceil(total / payloadSize); // Calculate total packets

        let offset = 0;
        let packetID = 0;

        while (offset < total) {

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

            notifyCallback(chunk);

            // Update the offset and packet ID
            offset += payloadSize;
            packetID++;
        }
    }
}