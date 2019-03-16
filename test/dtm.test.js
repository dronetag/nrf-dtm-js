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

const dtm = new DTM.DTM('/dev/tty.usbmodem0006832816521');

describe('DTM utility test', () => {
    it('Frequency should be 000000', () => {
        expect(DTM.DTM_FREQUENCY(2402)).toBe('000000');
        expect(DTM.DTM_FREQUENCY(2480)).toBe('100111');
    });
    it(`Command format should be ['0F', '0F']`, () => {
        expect(DTM.DTM_CMD_FORMAT('0000111100001111')).toEqual(['0f', '0f']);
    });

});

describe('Command test', () => {
    it(`Setup command should be ['00', '00']`, () => {
        expect(dtm.createSetupCMD()).toEqual(['00', '00']);
    });

    it(`Transmitter command should be ['80', '00']`, () => {
        expect(dtm.createTransmitterCMD()).toEqual(['80', '00']);
    });

    it(`Receiver command should be ['40', '00']`, () => {
        expect(dtm.createReceiverCMD()).toEqual(['40', '00']);
    });

    it(`End command hould be ['C0', '00']`, () => {
        expect(dtm.createEndCMD()).toEqual(['c0', '00']);
    });
});

describe('Sending command test', () => {
    it(`Return value should be ['00', '00']`, async () => {
        expect(await dtm.sendCMD(dtm.createSetupCMD())).toEqual(Buffer(['00', '00']));
    });
    it(`Return value should be ['00', '00']`, async () => {
        expect(await dtm.sendCMD(dtm.createTransmitterCMD())).toEqual(Buffer(['00', '00']));
    });
    it(`Return value should be ['00', '00']`, async () => {
        expect(await dtm.sendCMD(dtm.createEndCMD())).toEqual(Buffer(['00', '00']));
    });
});
