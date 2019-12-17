/**
 * copyright (c) 2015 - 2018, Nordic Semiconductor ASA
 *
 * all rights reserved.
 *
 * redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. redistributions in binary form, except as embedded into a nordic
 *    semiconductor asa integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 3. neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 4. this software, with or without modification, must only be used with a
 *    Nordic Semiconductor ASA integrated circuit.
 *
 * 5. any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * this software is provided by Nordic Semiconductor ASA "as is" and any express
 * or implied warranties, including, but not limited to, the implied warranties
 * of merchantability, noninfringement, and fitness for a particular purpose are
 * disclaimed. in no event shall Nordic Semiconductor ASA or contributors be
 * liable for any direct, indirect, incidental, special, exemplary, or
 * consequential damages (including, but not limited to, procurement of substitute
 * goods or services; loss of use, data, or profits; or business interruption)
 * however caused and on any theory of liability, whether in contract, strict
 * liability, or tort (including negligence or otherwise) arising in any way out
 * of the use of this software, even if advised of the possibility of such damage.
 *
 */

/* eslint-disable class-methods-use-this */

import EventEmitter from 'events';

import SerialPort from 'serialport';

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

// 2 bits
const DTM_EVENT = {
    LE_TEST_STATUS_EVENT: 0,
    LE_PACKET_REPORT_EVENT: 1,
};

const DTM_CMD_FORMAT = cmd => {
    const firstByte = parseInt(cmd.substring(0, 8), 2).toString(16).padStart(2, '0');
    const secondByte = parseInt(cmd.substring(8, 16), 2).toString(16).padStart(2, '0');
    return Buffer.from([`0x${firstByte}`, `0x${secondByte}`]);
};

const toBitString = (data, length = 6) => data.toString(2).padStart(length, '0');

const cmdToHex = cmd => {
    const cmdString = cmd.toString('HEX').toUpperCase();
    return `0x${cmdString.substring(0, 2)} 0x${cmdString.substring(2, 4)}`;
};

class DTMTransport extends EventEmitter {
    constructor(comName) {
        super();
        this.port = new SerialPort(comName, { autoOpen: false, baudRate: 19200 });
        this.waitForOpen = null;
        this.addListeners();
    }

    log(message) {
        this.emit('log', { message: `DTM Transport: ${message}` });
    }

    addListeners() {
        this.port.on('data', data => {
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
                    this.log('Unexpected data length: ', data.length);
                }
            } else {
                this.log('Unhandled data: ', data);
            }
        });
        this.port.on('error', error => {
            this.log(error);
        });
        this.port.on('open', () => {
            this.log('Serialport is opened');
        });
    }

    open() {
        this.waitForOpen = new Promise(res => {
            this.port.open(err => {
                if (err && (err.message.includes('Error: Port is already open') || err.message.includes('Error: Port is opening'))) {
                    this.log(`Failed to open serialport with error: ${err}`);
                    throw err;
                }
                this.log('Succeeded to open serialport');
                res();
            });
        });
    }

    close() {
        this.log('Close serialport');
        return new Promise(res => {
            this.port.close(err => {
                if (err) {
                    this.log(`Failed to close serialport with error: ${err}`);
                    throw err;
                }
                this.log('Succeeded to close serialport');
                this.waitForOpen = null;
                res();
            });
        });
    }

    /**
     * Create command
     *
     * @param {string}cmdType the type of command from 1st to 2nd bit
     * @param {string}arg2 the parameter from 3nd to 8th bit
     * @param {string}arg3 the parameter from 9th to 14 bit
     * @param {string}arg4 the parameter from 15th to 16th bit
     *
     * @returns {DTM_CMD_FORMAT} formatted command
     */
    createCMD(cmdType, arg2, arg3, arg4) {
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
        dc = DTM_DC.DEFAULT,
    ) {
        this.log(`Create setup CMD with control: ${control}`);
        this.log(`Create setup CMD with parameter: ${parameter}`);
        this.log(`Create setup CMD with dc type: ${dc}`);
        const controlBits = toBitString(control);
        const parameterBits = toBitString(parameter);
        return this.createCMD(DTM_CMD.TEST_SETUP + controlBits + parameterBits + dc);
    }

    createEndCMD() {
        this.log('Create test end CMD');
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
        this.log(`Create transmitter CMD with frequency: ${frequency}`);
        this.log(`Create transmitter CMD with length: ${length}`);
        this.log(`Create transmitter CMD with packet type: ${pkt}`);
        const dtmFrequency = DTM_FREQUENCY(frequency);
        const dtmLength = toBitString(length);
        const dtmPkt = toBitString(pkt, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmFrequency + dtmLength + dtmPkt);
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
        frequency = 2402,
        length = 0,
        pkt = DTM_PKT.DEFAULT,
    ) {
        this.log(`Create receiver CMD with frequency: ${frequency}`);
        this.log(`Create receiver CMD with length: ${length}`);
        this.log(`Create receiver CMD with packet type: ${pkt}`);
        const dtmFrequency = DTM_FREQUENCY(frequency);
        const dtmLength = toBitString(length);
        const dtmPkt = toBitString(pkt, 2);
        return this.createCMD(DTM_CMD.RECEIVER_TEST + dtmFrequency + dtmLength + dtmPkt);
    }

    createTxPowerCMD(dbm) {
        this.log(`Create tx power CMD: ${dbm}`);
        const dtmDbm = toBitString(dbm);
        const dtmLength = toBitString(2);
        const dtmPkt = toBitString(DTM_PKT.PAYLOAD_VENDOR, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmDbm + dtmLength + dtmPkt);
    }

    createSelectTimerCMD(value) {
        this.log(`Create select timer CMD: ${value}`);
        const dtmTimer = toBitString(value);
        const dtmLength = toBitString(3);
        const dtmPkt = toBitString(DTM_PKT.PAYLOAD_VENDOR, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmTimer + dtmLength + dtmPkt);
    }

    sendCMD(cmd) {
        return new Promise(async res => {
            if (!this.waitForOpen) {
                this.open();
            }
            await this.waitForOpen;
            this.log(`Sending data: ${cmdToHex(cmd)}`);
            this.port.write(cmd);
            const responseTimeout = setTimeout(() => {
                this.callback = undefined;
                res();
            }, 1000);

            this.callback = data => {
                this.callback = undefined;
                clearTimeout(responseTimeout);
                this.log(`Receiving data: ${cmdToHex(data)}`);
                res(data);
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
    DTM_EVENT,
};
