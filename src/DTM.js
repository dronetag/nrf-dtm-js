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

import {
    DTMTransport, DTM_CONTROL, DTM_DC, DTM_PARAMETER, DTM_PKT, DTM_FREQUENCY, DTM_EVENT
} from './DTM_transport';
import { DTM_PHY_STRING, DTM_PKT_STRING, DTM_MODULATION_STRING } from './DTM_strings';

function channelToFrequency(channel) {
    return 2402 + 2 * channel;
}

function reportSuccess(report) {
    return (report[0] & 0x01) === 0;
}

class DTM {
    constructor(comName, logger) {
        this.dtmTransport = new DTMTransport(comName);
        this.logger = logger;

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
        if (this.logger !== undefined) {
            this.logger.info(`DTM: ${message}`);
        }
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
        const status = await this.endEventDataReceived();
        this.endTimeoutEvent(this.timeoutEvent);
        return status;
    }

    async sweepTransmitterTest(bitpattern,
        length,
        channelLow,
        channelHigh,
        sweepTime = 1000,
        timeout = 0,
        randomPattern = false) {
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
            await this.setupReset();
            await this.setupLength();
            await this.setupPhy();
            await this.setupModulation();
            await this.setTxPower();
            await this.selectTimer();

            const cmd = this.carrierTestCMD(frequency, length, bitpattern);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const response = await this.dtmTransport.sendCMD(cmd);
            this.isTransmitting = true;

            if (!reportSuccess(response)) {
                this.isTransmitting = false;
                this.endTimeoutEvent(this.timeoutEvent);
                return { success: false, message: 'Could not start transmission.' };
            }

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
        const status = await endEventDataReceivedEvt;
        this.endTimeoutEvent(this.timeoutEvent);
        return status;
    }



    async sweepReceiverTest(
        channelLow,
        channelHigh,
        sweepTime = 1000,
        timeout = 0,
        randomPattern = false
    ) {
        if (this.isReceiving) {
            // Stop previous transmission
        }
        this.isReceiving = false
        const packetsReceivedForChannel = new Array(channelHigh - channelLow + 1).fill(0);
        this.timeoutEvent = this.startTimeoutEvent(() => this.isReceiving, timeout);
        let currentChannelIdx = 0;
        do {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            this.sweepTimedOut = false;
            this.isReceiving = false;
            await this.setupReset();
            await this.setupPhy();
            await this.setupModulation();
            await this.selectTimer();

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
            const sweepTimeoutEvent = this.startSweepTimeoutEvent(() => this.isReceiving,
                sweepTime);
            this.sweepTimedOut = false;
            if (this.timedOut) {
                this.endCurrentTest();
            }

            const status = await endEventDataReceivedEvt;
            this.endTimeoutEvent(sweepTimeoutEvent);

            if (status.success) {
                packetsReceivedForChannel[currentChannelIdx] += status.received
            } else {
                this.endTimeoutEvent(this.timeoutEvent);
                return {
                    success: false,
                    message: 'Failed to send receive end event.',
                };
            }

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

DTM.DTM_PKT = DTM_PKT;
DTM.DTM_CONTROL = DTM_CONTROL;
DTM.DTM_PARAMETER = DTM_PARAMETER;

export { DTM, DTM_PHY_STRING, DTM_PKT_STRING, DTM_MODULATION_STRING };
