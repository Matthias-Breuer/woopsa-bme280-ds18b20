const BME280 = require('bme280-sensor');
const WOOPSA = require('woopsa');
const ds18x20 = require('ds18x20');
const os = require('os');
const moment = require('moment-timezone');

// The BME280 constructor options are optional.
// 
const options = {
    i2cBusNo: 1, // defaults to 1
    i2cAddress: BME280.BME280_DEFAULT_I2C_ADDRESS() // defaults to 0x77
};

const bme280 = new BME280(options);

const WaitTime = 5000;

function queryFromLabsq(data) {

    var probenahme = new Date(data.time),
        minutes = data.time.getMinutes(),
        mess_datum = moment(data.time).tz(dtZone).format(dtFormat);
    probenahme.setMinutes(0);
    probenahme.setSeconds(0);
    probenahme.setMilliseconds(0);
    console.log(`data = ${JSON.stringify(data, null, 2)}`);
    const probenahmestr = moment(probenahme).tz(dtZone).format(dtFormat);
    console.log('sampling time is ' + probenahmestr + ' at minute ' + minutes);

}

/* prepare the sampling time */
const dtFormat = 'YYYY-MM-DD HH:mm:ss',
      dtZone = 'Europe/Berlin';

var lastTime = new Date();
var minute = (lastTime.getMinutes() + 2) % 60;
var result = {
        temperature: 0.0,
        pressure: 0.0,
        humidity: 0.0,
        auxiliary: 0.0,
        time: undefined,
        object: "not yet available"
    },
    sum = {
        temperature: 0.0,
        pressure: 0.0,
        humidity: 0.0,
        auxiliary: 0.0,
        time: undefined,
        count: 0
    };

// Read BME280 sensor data, repeat
//
const readSensorData = () => {
    bme280.readSensorData()
        .then((data) => {
            /* when next minute is reached - set new averaged result */
            var now = new Date();
            if (now.getMinutes() === minute) {
                if (sum.count > 0) {
                    result.temperature = Math.round(10.0 * sum.temperature / sum.count) / 10.0;
                    result.pressure = Math.round(10.0 * sum.pressure / sum.count) / 10.0;
                    result.humidity = Math.round(10.0 * sum.humidity / sum.count) / 10.0;
                    result.auxiliary = Math.round(10.0 * sum.auxiliary / sum.count) / 10.0;
                    result.time = new Date(sum.time);
                    result.object = JSON.stringify({
                        temperature: result.temperature,
                        pressure: result.pressure,
                        humidity: result.humidity,
                        auxiliary: result.auxiliary,
                        time: moment(result.time).tz(dtZone).format(dtFormat)
                    });
                    console.log(`result = ${JSON.stringify(result, null, 2)}`);
                } else {
                    console.log('no data at ' + sum.time);
                }
                sum.temperature = 0.0;
                sum.pressure = 0.0;
                sum.humidity = 0.0;
                sum.auxiliary = 0.0;
                sum.count = 0;
                sum.time = undefined;
                minute = (minute + 1) % 60;
            }
            /* add result to existing sum */
            sum.temperature += data.temperature_C;
            sum.pressure += data.pressure_hPa;
            sum.humidity += data.humidity;
            if (ds18x20device.startsWith('00-')) {
                sum.auxiliary += 0.0;
            } else {
                sum.auxiliary += ds18x20.get(ds18x20device);
            }
            sum.time = new Date(now);
            sum.count += 1;
            /* wait about 6 seconds before querying the next result */
            setTimeout(readSensorData, WaitTime);
        })
        .catch((err) => {
            console.log(`BME280 read error: ${err}`);
            /* wait about 6 seconds before querying the next result */
            setTimeout(readSensorData, WaitTime);
        });
};

const hostname = os.hostname();
console.log('woopsa-index.js is running at ' + hostname);

// find DS18B20 sensors
//
var ds18x20device = '00-';
if (ds18x20.isDriverLoaded()) {
    ds18x20device = ds18x20.list()[0];
    console.log('Found first DS18x20 with chip ID: ' + ds18x20device);
}


// Initialize the BME280 sensor
//
bme280.init()
    .then(() => {
        console.log('BME280 initialization succeeded');
        readSensorData();
    })
    .catch((err) => console.error(`BME280 initialization failed: ${err} `));

const woopsaServer = new WOOPSA.Server(result);
