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
/* eslint-disable no-await-in-loop */
/* eslint-disable no-bitwise */

import EventEmitter from 'events';

import { DTM_MODULATION_STRING, DTM_PHY_STRING, DTM_PKT_STRING } from './DTM_strings';
import {
    DTMTransport,
    DTM_CONTROL,
    DTM_DC,
    DTM_EVENT,
    DTM_PARAMETER,
    DTM_PKT,
} from './DTM_transport';

function channelToFrequency(channel) {
    return 2402 + 2 * channel;
}

function reportSuccess(report) {
    if (report === undefined
        || report === null
        || typeof report !== 'object'
        || report.length !== 2) {
        return false;
    }
    return (report[0] & 0x01) === 0;
}

class DTM extends EventEmitter {
    constructor(comName) {
        super();
        this.dtmTransport = new DTMTransport(comName);
        // Setting default paramters
        this.lengthPayload = 1;
        this.modulationPayload = DTM.DTM_PARAMETER.STANDARD_MODULATION_INDEX;
        this.phyPayload = DTM.DTM_PARAMETER.PHY_LE_1M;
        this.dbmPayload = 0;
        this.selectedTimer = 0;


        this.isTransmitting = false;
        this.isReceiving = false;
        this.timedOut = false;
    }

    log(message) {
        this.emit('log', { message: `DTM: ${message}` });
    }

    callback(event) {
        this.emit('update', event);
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
        return new Promise(done => {
            this.onEndEvent = (success, received) => {
                this.onEndEvent = null;
                done({ success, received });
            };
        });
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

    carrierTestCMD(frequency, length, bitpattern) {
        let lengthParam = length & 0x3F;
        if (bitpattern === DTM.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 0;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    carrierTestStudioCMD(frequency, length, bitpattern) {
        let lengthParam = length & 0x3F;
        if (bitpattern === DTM.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 1;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    /**
     * Set TX power for transmissions
     *
     * @param {number} dbm signal strength [-40dbm, +8dbm]
     *
     * @returns {object} response from device
     */
    async setTxPower(dbm = this.dbmPayload) {
        this.dbmPayload = dbm;
        const value = dbm & 0x3F;
        const cmd = this.dtmTransport.createTxPowerCMD(value);
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Select timer to use
     *
     * @param {number} timer to use
     *
     * @returns {object} response from device
     */
    async selectTimer(timer = this.selectedTimer) {
        this.selectedTimer = timer;
        const cmd = this.dtmTransport.createSelectTimerCMD(timer);
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Run setup reset command
     *
     * @returns {object} response from device
     */
    async setupReset() {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.RESET,
            DTM_PARAMETER.DEFAULT,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Setup packet length
     *
     * @param {number} length of transmit packets
     *
     * @returns {object} response from device
     */
    async setupLength(length = this.lengthPayload) {
        this.lengthPayload = length;
        const lengthBits = length >> 6;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.ENABLE_LENGTH,
            lengthBits,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Setup physical layer (PHY)
     *
     * @param {number} phy setting selected [PHY_LE_1M, PHY_LE_2M,
      PHY_LE_CODED_S2, PHY_LE_CODED_S8]
     *
     * @returns {object} response from device
     */
    async setupPhy(phy = this.phyPayload) {
        this.phyPayload = phy;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.PHY,
            phy,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Setup modulation type
     *
     * @param {number} modulation setting selected [STANDARD_MODULATION_INDEX,
     STABLE_MODULATION_INDEX]
     *
     * @returns {object} response from device
     */
    async setupModulation(modulation = this.modulationPayload) {
        this.modulationPayload = modulation;
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.MODULATION,
            modulation,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Read device features
     *
     * @returns {object} response from device
     */
    async setupReadFeatures() {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.FEATURES,
            0,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Read supported max Tx/Rx
     *
     * @param {number} parameter is the type of information to read [
     SUPPORTED_MAX_TX_OCTETS,
     SUPPORTED_MAX_TX_TIME,
     SUPPORTED_MAX_RX_OCTETS,
     SUPPORTED_MAX_RX_TIME]
     *
     * @returns {object} response from device
     */
    async setupReadSupportedRxTx(parameter) {
        const cmd = this.dtmTransport.createSetupCMD(
            DTM_CONTROL.TXRX,
            parameter,
            DTM_DC.DEFAULT,
        );
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    /**
     * Run DTM transmitter test using a single channel
     *
     * @param {number} bitpattern to use
     * @param {number} length in bytes of transmit packets
     * @param {number} channel to use for transmission
     * @param {number} timeout of test in milliseconds. 0 disables timeout.
     *
     * @returns {object} object containing success state and number of received packets
     */
    async singleChannelTransmitterTest(bitpattern, length, channel, timeout = 0) {
        this.callback({
            type: 'reset',
        });
        if (this.isTransmitting) {
            // Stop previous transmission
        }
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

    /**
     * Run DTM transmitter test using a range of channels
     *
     * @param {number} bitpattern to use
     * @param {number} length in bytes of transmit packets
     * @param {number} channelLow is the fist channel in the range
      to use for sweep transmission.
     * @param {number} channelHigh is the last channel in the range
      to use for sweep transmission.
     * @param {number} sweepTime is the time in milliseconds before
      moving on to the next channel in the sweep range.
     * @param {number} timeout of test in milliseconds. 0 disables timeout.
     * @param {boolean} randomPattern is true for random channel sweep
      pattern, false for sequential channel sweep.
     *
     * @returns {object} object containing success state and number of received packets
     */
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
        if (this.isTransmitting) {
            // Stop previous transmission
        }
        this.isTransmitting = false;
        this.timeoutEvent = this.startTimeoutEvent(() => this.isTransmitting, timeout);
        let currentChannelIdx = 0;
        do {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            this.sweepTimedOut = false;
            this.isTransmitting = false;

            if (this.timedOut) {
                // eslint-disable-next-line
                continue;
            }

            const cmd = this.carrierTestCMD(frequency, length, bitpattern);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const sendCMDPromise = this.dtmTransport.sendCMD(cmd);
            if (this.timedOut) {
                // eslint-disable-next-line
                continue;
            }

            const response = await sendCMDPromise;
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

    /**
     * Run DTM receiver test using a single channel
     *
     * @param {number} channel to use for transmission
     * @param {number} timeout of test in milliseconds. 0 disables timeout.
     *
     * @returns {object} object containing success state and number of received packets
     */
    async singleChannelReceiverTest(channel, timeout = 0) {
        this.callback({
            type: 'reset',
        });
        if (this.isReceiving) {
            // Stop previous receiver
        }
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


    /**
     * Run DTM receiver test using a range of channels
     *
     * @param {number} channelLow is the fist channel in
      the range to use for sweep transmission.
     * @param {number} channelHigh is the last channel in the range
      to use for sweep transmission.
     * @param {number} sweepTime is the time in milliseconds before
      moving on to the next channel in the sweep range.
     * @param {number} timeout of test in milliseconds. 0 disables timeout.
     * @param {boolean} randomPattern is true for random channel sweep
      pattern, false for sequential channel sweep.
     *
     * @returns {object} object containing success state and number of received packets
     */
    async sweepReceiverTest(
        channelLow,
        channelHigh,
        sweepTime = 1000,
        timeout = 0,
        randomPattern = false,
    ) {
        this.callback({
            type: 'reset',
        });
        if (this.isReceiving) {
            // Stop previous transmission
        }
        this.isReceiving = false;
        const packetsReceivedForChannel = new Array(40).fill(0);
        this.timeoutEvent = this.startTimeoutEvent(() => this.isReceiving, timeout);
        let currentChannelIdx = 0;
        do {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            this.sweepTimedOut = false;
            this.isReceiving = false;
            if (this.timedOut) {
                // eslint-disable-next-line
                continue;
            }

            const cmd = this.dtmTransport.createReceiverCMD(frequency);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const responseEvent = this.dtmTransport.sendCMD(cmd);

            if (this.timedOut) {
                // eslint-disable-next-line
                continue;
            }
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

            const sweepTimeoutEvent = this.startSweepTimeoutEvent(
                () => this.isReceiving,
                sweepTime,
            );
            this.sweepTimedOut = false;
            if (this.timedOut) {
                this.endCurrentTest();
            }

            const status = await endEventDataReceivedEvt;
            this.endTimeoutEvent(sweepTimeoutEvent);

            if (status.success) {
                packetsReceivedForChannel[channelLow + currentChannelIdx] += status.received;
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

    /**
     * End any running DTM test
     *
     * @returns {null} nothing is returned
     */
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

DTM.DTM_PKT = DTM_PKT;
DTM.DTM_CONTROL = DTM_CONTROL;
DTM.DTM_PARAMETER = DTM_PARAMETER;

export {
    DTM,
    DTM_PHY_STRING,
    DTM_PKT_STRING,
    DTM_MODULATION_STRING,
};
