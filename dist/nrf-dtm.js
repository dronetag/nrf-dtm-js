'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var SerialPort = _interopDefault(require('serialport'));
var Debug = _interopDefault(require('debug'));

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

function toBitString(data, length = 6) {
    return data.toString(2).padStart(length, '0');
}

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
     * Create receiver command
     *
     * @param {DTM_FREQUENCY} frequency the frequency to set
     *
     * @returns {createCMD} created command
     */
    createReceiverCMD(frequency = 2402) {
        const dtmFrequency = DTM_FREQUENCY(frequency);
        const dtmLength = toBitString(0);
        const dtmPkt = toBitString(DTM_PKT.DEFAULT);
        return this.createCMD(DTM_CMD.RECEIVER_TEST + dtmFrequency + dtmLength + dtmPkt);
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

    createSelectTimerCMD(value) {
        const dtmTimer = toBitString(value);
        const dtmLength = toBitString(3);
        const dtmPkt = toBitString(DTM_PKT.PAYLOAD_VENDOR, 2);
        return this.createCMD(DTM_CMD.TRANSMITTER_TEST + dtmTimer + dtmLength + dtmPkt);
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
                };
                this.port.on('close', whenPortIsClosed);
                this.close();
                debug(data);


            };
        });
    }
}

const DTM_PHY_STRING = {
    0x01: 'LE 1Mbps',
    0x02: 'LE 2Mbps',
    0x03: 'LE Coded S8',
    0x04: 'LE Coded S2',
};

const DTM_PKT_STRING = {
    0x00: 'PRBS9',
    0x01: '11110000',
    0x02: '10101010',
    0x03: 'Constant',
};

const DTM_MODULATION_STRING = {
    0x00: 'Standard',
    0x01: 'Stable',
};

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

function channelToFrequency(channel) {
    return 2402 + 2 * channel;
}

function reportSuccess(report) {
    return (report[0] & 0x01) === 0;
}

class DTM$1 {
    constructor(comName, logger) {
        this.dtmTransport = new DTMTransport(comName);
        this.logger = logger;

        // Setting default paramters
        this.lengthPayload = 1;
        this.modulationPayload = DTM$1.DTM_PARAMETER.STANDARD_MODULATION_INDEX;
        this.phyPayload = DTM$1.DTM_PARAMETER.PHY_LE_1M;
        this.dbmPayload = 0;
        this.selectedTimer = 0;


        this.isTransmitting = false;
        this.isReceiving = false;
        this.timedOut = false;
        this.listeners = [];

    }

    log(message) {
        if (this.logger !== undefined) {
            this.logger.info(`DTM: ${message}`);
        }
    }

    callback(event) {
        this.listeners.forEach(listener => {
            listener(event);
        });
    }

    addListener(func) {
        this.listeners.push(func);
    }

    async setupReset() {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.RESET,
            DTM_PARAMETER.DEFAULT,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async setupLength(length = this.lengthPayload) {
        this.lengthPayload = length;
        const lengthBits = length >> 6;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.ENABLE_LENGTH,
            lengthBits,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async setupPhy(payload = this.phyPayload) {
        this.phyPayload = payload;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.PHY,
            payload,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async setupModulation(payload = this.modulationPayload) {
        this.modulationPayload = payload;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.MODULATION,
            payload,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async setupReadFeatures() {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.FEATURES,
            0,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async setupReadSupportedRxTx(parameter) {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.TXRX,
            parameter,
            DTM_DC.DEFAULT
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    startTimeoutEvent(rxtxFlag, timeout) {
        let timeoutEvent;
        this.timedOut = false;
        if (timeout > 0) {
            timeoutEvent = setTimeout(() => {
                this.timedOut = true;
                if (rxtxFlag()) {
                    if (!this.sweepTimedOut) {
                        this.endCurrentTest();
                    }
                }
            }, timeout);
        }
        return timeoutEvent;
    }

    startSweepTimeoutEvent(rxtxFlag, timeout) {
        let timeoutEvent;
        this.sweepTimedOut = false;
        if (timeout > 0) {
            timeoutEvent = setTimeout(() => {
                this.sweepTimedOut = true;
                if (rxtxFlag()) {
                    if (!this.timedOut) {
                        this.endCurrentTest();
                    }
                }
            }, timeout);
        }
        return timeoutEvent;
    }

    endTimeoutEvent(event) {
        if (event !== undefined) {
            clearTimeout(event);
        }
    }

    endEventDataReceived() {
        return new Promise (done => {
            this.onEndEvent = (success, received) => {
                done({ success, received });
            };
        });
    }

    carrierTestCMD(frequency, length, bitpattern) {
        let lengthParam = length & 0x3F;
        if (bitpattern === DTM$1.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 0;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    carrierTestStudioCMD(frequency, length, bitpattern) {
        let lengthParam = length & 0x3F;
        if (bitpattern === DTM$1.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 1;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    /**
     * Set TX power
     *
     * @param {dbm} signal strength [-40dbm, +8dbm]
     *
     * @returns {createCMD} created command
     */
    async setTxPower(dbm = this.dbmPayload) {
        this.dbmPayload = dbm;
        const value = dbm & 0x3F;
        const cmd = this.dtmTransport.createTxPowerCMD(value);
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Set TX power
     *
     * @param {dbm} signal strength [-40dbm, +8dbm]
     *
     * @returns {createCMD} created command
     */
    async selectTimer(timer = this.selectedTimer) {
        this.selectedTimer = timer;
        const cmd = this.dtmTransport.createSelectTimerCMD(timer);
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async singleChannelTransmitterTest(bitpattern, length, channel, timeout = 0) {
        this.callback({
            type: 'reset',
        });
        this.isTransmitting = true;
        this.timeoutEvent = this.startTimeoutEvent(() => this.isTransmitting, timeout);
        this.sweepTimedOut = false;
        this.timedOut = false;

        const frequency = channelToFrequency(channel);
        const cmd = this.carrierTestCMD(frequency, length, bitpattern);
        const response = await this.dtmTransport.sendCMD(cmd);

        if (!reportSuccess(response)) {
            this.endTimeoutEvent(this.timeoutEvent);
            return { success: false, message: 'Could not start transmission.' };
        }
        this.callback({
            action: 'started',
            type: 'transmitter',
            channel,
        });
        const status = await this.endEventDataReceived();
        this.endTimeoutEvent(this.timeoutEvent);
        this.callback({
            action: 'ended',
            type: 'transmitter',
            channel,
        });
        return status;
    }

    async sweepTransmitterTest(bitpattern,
        length,
        channelLow,
        channelHigh,
        sweepTime = 1000,
        timeout = 0,
        randomPattern = false) {
        this.callback({
            type: 'reset',
        });
        this.isTransmitting = false;
        this.timeoutEvent = this.startTimeoutEvent(() => this.isTransmitting, timeout);
        let currentChannelIdx = 0;
        do {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            this.sweepTimedOut = false;
            this.isTransmitting = false;
            await this.setupReset();
            await this.selectTimer();
            await this.setTxPower();
            await this.setupLength();
            await this.setupModulation();
            await this.setupPhy();

            const cmd = this.carrierTestCMD(frequency, length, bitpattern);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const response = await this.dtmTransport.sendCMD(cmd);
            this.isTransmitting = true;

            if (!reportSuccess(response)) {
                this.isTransmitting = false;
                this.endTimeoutEvent(this.timeoutEvent);
                return { success: false, message: 'Could not start transmission.' };
            }
            this.callback({
                action: 'started',
                type: 'transmitter',
                channel: channelLow + currentChannelIdx,
            });

            const sweepTimeoutEvent = this.startSweepTimeoutEvent(() => this.isTransmitting,
                sweepTime);
            this.sweepTimedOut = false;
            if (this.timedOut) {
                this.endCurrentTest();
            }

            const status = await endEventDataReceivedEvt;
            this.endTimeoutEvent(sweepTimeoutEvent);

            if (status.success) {
                // No packets should have been received
            } else {
                this.isTransmitting = false;
                this.endTimeoutEvent(this.timeoutEvent);
                return { success: false, message: 'Failed to send transmission end event.' };
            }
            this.callback({
                action: 'ended',
                type: 'transmitter',
                channel: channelLow + currentChannelIdx,
            });

            if (randomPattern) {
                currentChannelIdx = Math.floor(Math.random() * (channelHigh - channelLow));
            } else {
                currentChannelIdx = (currentChannelIdx + 1) % (channelHigh - channelLow + 1);
            }
        } while (this.isTransmitting && !this.timedOut);

        this.endTimeoutEvent(this.timeoutEvent);
        return { success: true, received: 0 };
    }

    async singleChannelReceiverTest(channel, timeout = 0) {
        this.callback({
            type: 'reset',
        });
        this.isReceiving = true;
        this.timeoutEvent = this.startTimeoutEvent(() => this.isReceiving, timeout);
        this.timedOut = false;
        this.sweepTimedOut = false;

        const frequency = channelToFrequency(channel);
        const cmd = this.dtmTransport.createReceiverCMD(frequency);
        const endEventDataReceivedEvt = this.endEventDataReceived();
        const response = await this.dtmTransport.sendCMD(cmd);

        if (!reportSuccess(response)) {
            this.endTimeoutEvent(this.timeoutEvent);
            return { success: false, message: 'Could not start receiver.' };
        }
        this.callback({
            action: 'started',
            type: 'receiver',
            channel,
        });
        const status = await endEventDataReceivedEvt;
        this.endTimeoutEvent(this.timeoutEvent);
        this.callback({
            action: 'ended',
            type: 'receiver',
            channel,
            packets: status.received,
        });
        return status;
    }



    async sweepReceiverTest(
        channelLow,
        channelHigh,
        sweepTime = 1000,
        timeout = 0,
        randomPattern = false
    ) {
        this.callback({
            type: 'reset',
        });
        this.isReceiving = false;
        const packetsReceivedForChannel = new Array(channelHigh - channelLow + 1).fill(0);
        this.timeoutEvent = this.startTimeoutEvent(() => this.isReceiving, timeout);
        let currentChannelIdx = 0;
        do {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            this.sweepTimedOut = false;
            this.isReceiving = false;
            await this.setupReset();
            await this.selectTimer();
            await this.setupModulation();
            await this.setupPhy();

            const cmd = this.dtmTransport.createReceiverCMD(frequency);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const responseEvent =  this.dtmTransport.sendCMD(cmd);
            const response = await responseEvent;
            this.isReceiving = true;

            if (!reportSuccess(response)) {
                this.endTimeoutEvent(this.timeoutEvent);
                return {
                    success: false,
                    message: 'Could not start receiver.',
                };
            }

            this.callback({
                action: 'started',
                type: 'receiver',
                channel: channelLow + currentChannelIdx,
            });

            const sweepTimeoutEvent = this.startSweepTimeoutEvent(() => this.isReceiving,
                sweepTime);
            this.sweepTimedOut = false;
            if (this.timedOut) {
                this.endCurrentTest();
            }

            const status = await endEventDataReceivedEvt;
            this.endTimeoutEvent(sweepTimeoutEvent);

            if (status.success) {
                packetsReceivedForChannel[currentChannelIdx] += status.received;
            } else {
                this.endTimeoutEvent(this.timeoutEvent);
                return {
                    success: false,
                    message: 'Failed to send receive end event.',
                };
            }
            this.callback({
                action: 'ended',
                type: 'receiver',
                channel: channelLow + currentChannelIdx,
                packets: status.received,
            });

            if (randomPattern) {
                currentChannelIdx = Math.ceil(Math.random() * (channelHigh - channelLow));
            } else {
                currentChannelIdx = (currentChannelIdx + 1) % (channelHigh - channelLow + 1);
            }
        } while (this.isReceiving && !this.timedOut);

        this.endTimeoutEvent(this.timeoutEvent);
        return {
            success: true,
            received: packetsReceivedForChannel.reduce((a, b) => a + b),
            receivedPerChannel: packetsReceivedForChannel,
        };
    }

    async transmitterTest(bitpattern, length, channelConfig) {
        if (channelConfig.useSingleChannel) {
            const response = this.singleChannelTransmitterTest(
                bitpattern,
                length,
                channelConfig.singleChannelNum,
                1000
            );
            return response;
        }
        return null;
    }


    async endCurrentTest() {
        const cmd = this.dtmTransport.createEndCMD();
        const response = await this.dtmTransport.sendCMD(cmd);
        const event = (response[0] & 0x80) >> 7;
        let receivedPackets = 0;

        if (event === DTM_EVENT.LE_PACKET_REPORT_EVENT) {
            const MSB = response[0] & 0x3F;
            const LSB = response[1];
            receivedPackets = (MSB << 8) | LSB;
        }
        if (this.onEndEvent) {
            this.onEndEvent(true, receivedPackets);
        }
        return response;
    }

    async endTest() {
        if (this.timedOut) {
            return;
        }
        this.timedOut = true;
        this.endTimeoutEvent(this.timeoutEvent);

        if (!this.sweepTimedOut && (this.isTransmitting || this.isReceiving)) {
            this.endCurrentTest();
        }
    }
}

DTM$1.DTM_PKT = DTM_PKT;
DTM$1.DTM_CONTROL = DTM_CONTROL;
DTM$1.DTM_PARAMETER = DTM_PARAMETER;




var DTM$2 = Object.freeze({
	DTM: DTM$1,
	DTM_PHY_STRING: DTM_PHY_STRING,
	DTM_PKT_STRING: DTM_PKT_STRING,
	DTM_MODULATION_STRING: DTM_MODULATION_STRING
});

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

module.exports = DTM$2;
//# sourceMappingURL=nrf-dtm.js.map
