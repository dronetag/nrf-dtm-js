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
    DTMTransport, DTM_CONTROL, DTM_DC, DTM_PARAMETER, DTM_PKT, DTM_FREQUENCY,
} from './DTM_transport';

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

        this.DTM_PKT = DTM_PKT;
        this.DTM_CONTROL = DTM_CONTROL;
        this.DTM_PARAMETER = DTM_PARAMETER;

        // Setting default paramters
        this.lengthPayload = 1;
        this.modulationPayload = this.DTM_PARAMETER.STANDARD_MODULATION_INDEX;
        this.phyPayload = this.DTM_PARAMETER.PHY_LE_1M;
        this.dbmPayload = 0;


        this.isTransmitting = false;
        this.isReceiving = false;

        this.packetsReceived = 0;
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
        if (timeout > 0) {
            timeoutEvent = setTimeout(() => {
                if (rxtxFlag()) {
                    this.endTest();
                }
            }, timeout);
        }
        return timeoutEvent;
    }

    startSweepTimeoutEvent(rxtxFlag, timeout) {
        let timeoutEvent;
        if (timeout > 0) {
            timeoutEvent = setTimeout(() => {
                if (rxtxFlag()) {
                    this.endCurrentTest();
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
        let lengthParam = length;
        if (bitpattern === this.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 0;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    carrierTestStudioCMD(frequency, length, bitpattern) {
        let lengthParam = length;
        if (bitpattern === this.DTM_PKT.PAYLOAD_VENDOR) {
            lengthParam = 1;
        }
        return this.dtmTransport.createTransmitterCMD(frequency, lengthParam, bitpattern);
    }

    /**
     * Set TX power
     *
     * @param {dbm} signal strength [-40dbm, +4dbm]
     *
     * @returns {createCMD} created command
     */
    async setTxPower(dbm = this.dbmPayload) {
        this.dbmPayload = dbm;
        const value = dbm & 0x3F;
        const cmd = this.dtmTransport.createTxPowerCMD(dbm);
        const response = await this.dtmTransport.sendCMD(cmd);
        return response;
    }

    async singleChannelTransmitterTest(bitpattern, length, channel, timeout = 0) {
        if (this.isTransmitting) {
            // Stop previous transmission
        }
        this.isTransmitting = true;
        const timeoutEvent = this.startTimeoutEvent(this.isTransmitting, timeout);

        const frequency = channelToFrequency(channel);
        const cmd = this.carrierTestCMD(frequency, length, bitpattern);
        const response = await this.dtmTransport.sendCMD(cmd);

        if (!reportSuccess(response)) {
            this.endTimeoutEvent(timeoutEvent);
            return { success: false, message: 'Could not start transmission.' };
        }
        const status = await this.endEventDataReceived();
        this.endTimeoutEvent(timeoutEvent);
        return status;
    }

    async sweepTransmitterTest(bitpattern, length, channelLow, channelHigh, sweepTime = 1000, timeout = 0, randomPattern = false) {
        if (this.isTransmitting) {
            // Stop previous transmission
        }
        this.isTransmitting = true;
        const timeoutEvent = this.startTimeoutEvent(() => this.isTransmitting, timeout);
        let currentChannelIdx = 0;
        while (this.isTransmitting) {
            const frequency = channelToFrequency(channelLow + currentChannelIdx);
            await this.setupReset();
            await this.setupLength();
            await this.setupPhy();
            await this.setupModulation();
            await this.setTxPower();
            const cmd = this.carrierTestCMD(frequency, length, bitpattern);
            const endEventDataReceivedEvt = this.endEventDataReceived();
            const response = await this.dtmTransport.sendCMD(cmd);
            if (!reportSuccess(response)) {
                this.endTimeoutEvent(timeoutEvent);
                return { success: false, message: 'Could not start transmission.' };
            }

            const sweepTimeoutEvent = this.startSweepTimeoutEvent(() => this.isTransmitting, sweepTime);
            const status = await endEventDataReceivedEvt;
            this.endTimeoutEvent(sweepTimeoutEvent);
            if (randomPattern) {
                currentChannelIdx = Math.floor(Math.random() * (channelHigh - channelLow));
            } else {
                currentChannelIdx = (currentChannelIdx + 1) % (channelHigh - channelLow);
            }
        }
        console.log(this.isTransmitting)
        const status = await this.endEventDataReceived();
        this.endTimeoutEvent(timeoutEvent);
        return status;
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
        //console.log(this.dtmTransport.port)
        const cmd = this.dtmTransport.createEndCMD();
        const response = await this.dtmTransport.sendCMD(cmd);
        if (this.onEndEvent) {
            this.onEndEvent(0, 0);
        }
        return response;
    }

    async endTest() {
        this.isTransmitting = false;
        this.isReceiving = false;
        return this.endCurrentTest();
    }
}

export { DTM };
