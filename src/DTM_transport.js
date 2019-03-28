import SerialPort from 'serialport';
import Debug from 'debug';

// 2 bits
const DTM_CMD = {
    TEST_SETUP: '00',
    RECEIVER_TEST: '01',
    TRANSMITTER_TEST: '10',
    TEST_END: '11',
};

// 6 bits
const DTM_CONTROL = {
    // Test setup cmd
    RESET: 0x00,
    ENABLE_LENGTH: 0x01,
    PHY: 0x02,
    MODULATION: 0x03,
    FEATURES: 0x04,
    TXRX: 0x05,

    // Test end cmd
    END: 0x00,
};

// 6 bits
const DTM_FREQUENCY = f => ((f - 2402) / 2).toString(2).padStart(6, '0');

const DTM_PARAMETER = {
    DEFAULT: 0x00,
    PHY_LE_1M: 0x01,
    PHY_LE_2M: 0x02,
    PHY_LE_CODED_S8: 0x03,
    PHY_LE_CODED_S2: 0x04,

    STANDARD_MODULATION_INDEX: 0x00,
    STABLE_MODULATION_INDEX: 0x01,

    SUPPORTED_MAX_TX_OCTETS: 0x00,
    SUPPORTED_MAX_TX_TIME: 0x01,
    SUPPORTED_MAX_RX_OCTETS: 0x02,
    SUPPORTED_MAX_RX_TIME: 0x03,
};

// 2 bits
const DTM_PKT = {
    DEFAULT: 0x00,
    PAYLOAD_PRBS9: 0x00,
    PAYLOAD_11110000: 0x01,
    PAYLOAD_10101010: 0x02,
    PAYLOAD_VENDOR: 0x03,
};

// 2 bits
const DTM_DC = {
    DEFAULT: '00',
};

function toBitString(data, length = 6) {
    return data.toString(2).padStart(length, '0');
}

// 6 bits
const DTM_LENGTH = l => toBitString(l);

const DTM_CMD_FORMAT = cmd => {
    const firstByte = parseInt(cmd.substring(0, 8), 2).toString(16).padStart(2, '0');
    const secondByte = parseInt(cmd.substring(8, 16), 2).toString(16).padStart(2, '0');
    return Buffer.from([`0x${firstByte}`, `0x${secondByte}`]);
};

const debug = Debug('dtm');

class DTMTransport {
    constructor(comName) {
        this.port = new SerialPort(comName, { autoOpen: false, baudRate: 19200 });
        this.addListeners();
    }

    createCMD(cmdType, arg2, arg3, arg4) {
        debug(this);
        return DTM_CMD_FORMAT(cmdType + arg2 + arg3 + arg4);
    }

    /**
     * Create setup command
     *
     * @param {DTM_CONTROL} control the control to set
     * @param {DTM_PARAMETER} parameter the parameter to set
     * @param {DTM_DC} dc the dc to set
     *
     * @returns {createCMD} created command
     */
    createSetupCMD(
        control = DTM_CONTROL.RESET,
        parameter = DTM_PARAMETER.DEFAULT,
        dc = DTM_DC.DEFAULT
    ) {
        const controlBits = toBitString(control);
        const parameterBits = toBitString(parameter);
        return this.createCMD(DTM_CMD.TEST_SETUP + controlBits + parameterBits + dc);
    }


    addListeners() {
        this.port.on('data', data => {
            debug(data);
            if (this.callback) {
                if (data.length === 1) {
                    if (this.dataBuffer) {
                        this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
                        this.callback(this.dataBuffer);
                        this.dataBuffer = undefined;
                    } else {
                        this.dataBuffer = data;
                    }
                } else if (data.length === 2) {
                    this.callback(data);
                } else {
                    debug('Unexpected data length: ', data.length);
                }
            } else {
                debug('Unhandled data: ', data);
            }
        });
        this.port.on('error', error => {
            debug(error);
        });
        this.port.on('open', () => {
            debug('open');
        });
        /*this.port.on('close', () => {
            debug('close');
            console.log("closed port")
        });*/
    }

    open() {
        return new Promise(res => {
            this.port.open(err => {
                if (err && (err.message.includes('Error: Port is already open') || err.message.includes('Error: Port is opening'))) {
                    throw err;
                }
                res();
            });
        });
    }

    close() {
        return new Promise(res => {
            this.port.close(err => {
                if (err) {
                    throw err;
                }
                res();
            });
        });
    }

    /**
     * Create end command
     *
     * @returns {createCMD} created command
     */
    createEndCMD() {
        return this.createCMD(DTM_CMD.TEST_END
            + toBitString(DTM_CONTROL.END)
            + toBitString(DTM_PARAMETER.DEFAULT)
            + DTM_DC.DEFAULT);
    }

    /**
     * Create transmitter command
     *
     * @param {DTM_FREQUENCY} frequency the frequency to set
     * @param {DTM_LENGTH} length the length to set
     * @param {DTM_PKT} pkt the pkt to set
     *
     * @returns {createCMD} created command
     */
    createTransmitterCMD(
        frequency = 2402,
        length = 0,
        pkt = DTM_PKT.DEFAULT,
    ) {
        const dtmFrequency = DTM_FREQUENCY(frequency);
        const dtmLength = toBitString(length);
        const dtmPkt = toBitString(pkt, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmFrequency + dtmLength + dtmPkt);
    }

    /**
     * Create TX power command
     *

     */
    createTxPowerCMD(dbm) {
        const dtmDbm = toBitString(dbm);
        const dtmLength = toBitString(2);
        const dtmPkt = toBitString(DTM_PKT.PAYLOAD_VENDOR, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmDbm + dtmLength + dtmPkt);
    }

    /**
     * Create receiver command
     *
     * @param {DTM_FREQUENCY} frequency the frequency to set
     * @param {DTM_LENGTH} length the length to set
     * @param {DTM_PKT} pkt the pkt to set
     *
     * @returns {createCMD} created command
     */
    createReceiverCMD(
        frequency = DTM_FREQUENCY(2402),
        length = DTM_LENGTH(0),
        pkt = DTM_PKT.DEFAULT
    ) {
        return this.createCMD(DTM_CMD.RECEIVER_TEST + frequency + length + pkt);
    }

    sendCMD(cmd) {
        return new Promise(async res => {
            await this.open();
            this.port.write(cmd);
            this.callback = data => {
                this.callback = undefined;
                const whenPortIsClosed = () => {
                    this.port.removeListener('close', whenPortIsClosed);
                    res(data);
                }
                this.port.on('close', whenPortIsClosed);
                this.close();
                debug(data);


            };
        });
    }
}

export {
    DTMTransport,
    DTM_CONTROL,
    DTM_DC,
    DTM_PARAMETER,
    DTM_PKT,
    DTM_FREQUENCY,
};
