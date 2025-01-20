import bleno from "bleno";

export const SERVICE_UUID = "89496822200000000000000000000000";

const WRITE_CHARACTERISTIC_UUID = "89496822201000000000000000000000";
const NOTIFY_CHARACTERISTIC_UUID = "89496822202000000000000000000000";

export const bleCallbacks = {
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

export const configurationService = new bleno.PrimaryService({
    uuid: SERVICE_UUID,
    characteristics: [writeCharacteristic, notifyCharacteristic],
});
