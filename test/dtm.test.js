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

const DTM = require('../dist/nrf-dtm');

const dtm = new DTM.DTM('COM31');
/*
describe('DTM utility test', () => {
    it('Frequency should be 000000', () => {
        expect(DTM.DTM_FREQUENCY(2402)).toBe('000000');
        expect(DTM.DTM_FREQUENCY(2480)).toBe('100111');
    });
    it(`Command format should be ['0F', '0F']`, () => {
        expect(DTM.DTM_CMD_FORMAT('0000111100001111')).toEqual(Buffer.from(['0x0f', '0x0f']));
    });

});
*/

describe('Command test', () => {
    it(`Setup command should be ['0x00', '0x00']`, () => {
        expect(dtm.dtmTransport.createSetupCMD()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Transmitter command should be ['0x80', '0x00']`, () => {
        expect(dtm.dtmTransport.createTransmitterCMD()).toEqual(Buffer.from(['0x80', '0x00']));
    });

    it(`Receiver command should be ['0x40', '0x00']`, () => {
        expect(dtm.dtmTransport.createReceiverCMD()).toEqual(Buffer.from(['0x40', '0x00']));
    });

    it(`End command hould be ['0xC0', '0x00']`, () => {
        expect(dtm.dtmTransport.createEndCMD()).toEqual(Buffer.from(['0xc0', '0x00']));
    });
});

describe('Sending command test', () => {
    it(`Return value should be ['0x00', '0x00']`, async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createSetupCMD())).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it(`Return value should be ['0x00', '0x00']`, async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createTransmitterCMD())).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it(`Return value should be ['0x00', '0x00']`, async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createEndCMD())).toEqual(Buffer.from(['0x80', '0x00']));
    });
});

describe('Setup test', () => {
    it(`Setup reset succeeds`, async () => {
        expect(await dtm.setupReset()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Setup short packet length`, async () => {
        expect(await dtm.setupLength(0x01)).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it(`Setup long packet length`, async () => {
        expect(await dtm.setupLength(0x40)).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it(`Setup packet lengths longer than 0xFF will fail`, async () => {
        expect(await dtm.setupLength(0x100)).toEqual(Buffer.from(['0x00', '0x01']));
    });

    it(`Uncoded phy LE is supported`, async () => {
        expect(await dtm.setupPhy(dtm.DTM_PARAMETER.PHY_LE_1M)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupPhy(dtm.DTM_PARAMETER.PHY_LE_2M)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Coded phy LE is supported on nRF52840`, async () => {
        expect(await dtm.setupPhy(dtm.DTM_PARAMETER.PHY_LE_CODED_S8)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupPhy(dtm.DTM_PARAMETER.PHY_LE_CODED_S2)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Setup modulation index`, async () => {
        expect(await dtm.setupModulation(dtm.DTM_PARAMETER.STANDARD_MODULATION_INDEX)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupModulation(dtm.DTM_PARAMETER.STABLE_MODULATION_INDEX)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Read features`, async () => {
        const readFeatures = async () => {
            const buffer = await dtm.setupReadFeatures()
            buffer[0] &= 0x01; // LE_Test_Status_Event
            buffer[1] &= 0x80; // Success
            return buffer
        };
        expect(await readFeatures()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it(`Set TX power`, async () => {
        expect(await dtm.setTxPower(-40)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-80)).toEqual(Buffer.from(['0x00', '0x01']));
        expect(await dtm.setTxPower(-4)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(0)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(4)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(9)).toEqual(Buffer.from(['0x00', '0x01']));
    });
/*
    it(`Read TXRX`, async () => {
        const readSupportedRxTx = async param => {
            const buffer = await dtm.setupReadSupportedRxTx(param)
            buffer[0] &= 0x01; // LE_Test_Status_Event
            buffer[1] &= 0x80; // Success
            return buffer
        };
        expect(await readSupportedRxTx(dtm.DTM_PARAMETER.SUPPORTED_MAX_TX_TIME)).toEqual(Buffer.from(['0x00', '0x00']));
    });
*/
});
