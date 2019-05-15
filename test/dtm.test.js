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
const dtmReceiver = new DTM.DTM('COM27');

describe('Command test', () => {
    it('Setup command should be [\'0x00\', \'0x00\']', () => {
        expect(dtm.dtmTransport.createSetupCMD()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Transmitter command should be [\'0x80\', \'0x00\']', () => {
        expect(dtm.dtmTransport.createTransmitterCMD()).toEqual(Buffer.from(['0x80', '0x00']));
    });

    it('Receiver command should be [\'0x40\', \'0x00\']', () => {
        expect(dtm.dtmTransport.createReceiverCMD()).toEqual(Buffer.from(['0x40', '0x00']));
    });

    it('End command hould be [\'0xC0\', \'0x00\']', () => {
        expect(dtm.dtmTransport.createEndCMD()).toEqual(Buffer.from(['0xc0', '0x00']));
    });
});

describe('Sending command test', () => {
    it('Return value should be [\'0x00\', \'0x00\']', async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createSetupCMD())).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it('Return value should be [\'0x00\', \'0x00\']', async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createTransmitterCMD())).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it('Return value should be [\'0x00\', \'0x00\']', async () => {
        expect(await dtm.dtmTransport.sendCMD(dtm.dtmTransport.createEndCMD())).toEqual(Buffer.from(['0x80', '0x00']));
    });
});

describe('Setup test', () => {
    it('Setup reset succeeds', async () => {
        expect(await dtm.setupReset()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Setup short packet length', async () => {
        expect(await dtm.setupLength(0x01)).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it('Setup long packet length', async () => {
        expect(await dtm.setupLength(0x40)).toEqual(Buffer.from(['0x00', '0x00']));
    });
    it('Setup packet lengths longer than 0xFF will fail', async () => {
        expect(await dtm.setupLength(0x100)).toEqual(Buffer.from(['0x00', '0x01']));
    });

    it('Uncoded phy LE is supported', async () => {
        expect(await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_2M)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Coded phy LE is supported on nRF52840', async () => {
        expect(await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_CODED_S8)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_CODED_S2)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Setup modulation index', async () => {
        expect(await dtm.setupModulation(DTM.DTM.DTM_PARAMETER.STANDARD_MODULATION_INDEX)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setupModulation(DTM.DTM.DTM_PARAMETER.STABLE_MODULATION_INDEX)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Read features', async () => {
        const readFeatures = async () => {
            const buffer = await dtm.setupReadFeatures();
            buffer[0] &= 0x01; // LE_Test_Status_Event
            buffer[1] &= 0x80; // Success
            return buffer;
        };
        expect(await readFeatures()).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it('Set TX power', async () => {
        expect(await dtm.setupReset()).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-40)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-20)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-16)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-12)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-8)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(-4)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(0)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(2)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(3)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(4)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(5)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(6)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(7)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(8)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.setTxPower(9)).toEqual(Buffer.from(['0x00', '0x01']));
        expect(await dtm.setTxPower(1)).toEqual(Buffer.from(['0x00', '0x01']));
        expect(await dtm.setTxPower(-41)).toEqual(Buffer.from(['0x00', '0x01']));
    });

    it.skip('Select timer', async () => {
        expect(await dtm.setupReset()).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.selectTimer(0)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.selectTimer(1)).toEqual(Buffer.from(['0x00', '0x00']));
        expect(await dtm.selectTimer(2)).toEqual(Buffer.from(['0x00', '0x00']));
    });

    it.skip('Read TXRX', async () => {
        const readSupportedRxTx = async param => {
            const buffer = await dtm.setupReadSupportedRxTx(param)
            buffer[0] &= 0x01; // LE_Test_Status_Event
            buffer[1] &= 0x80; // Success
            return buffer
        };
        expect(await readSupportedRxTx(dtm.DTM_PARAMETER.SUPPORTED_MAX_TX_TIME)).toEqual(Buffer.from(['0x00', '0x00']));
    });
});


describe('Transmit and receive tests', () => {
    it('Transmit and receive single channel', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M)
        const transmitter = dtm.singleChannelTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 20, 0);
        const recv = await dtmReceiver.singleChannelReceiverTest(20, 2000);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toBeGreaterThan(1000);
    });

    it('Transmit on one channel. Receiver sweep on 5.', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M)
        const transmitter = dtm.singleChannelTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 20, 0);
        const recv = await dtmReceiver.sweepReceiverTest(18, 23, 50, 2000);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toBeGreaterThan(200);
    });

    it('Transmit on 5 channels. Receive on single channel.', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M)
        const transmitter = dtm.sweepTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 18, 23, 50, 0);
        const recv = await dtmReceiver.singleChannelReceiverTest(20, 2000);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toBeGreaterThan(200);
    });

    it('Transmit on 5 channels. Receive on 5 channels.', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M);
        const transmitter = dtm.sweepTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 18, 23, 100, 0);
        const recv = await dtmReceiver.sweepReceiverTest(18, 23, 15, 2000);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toBeGreaterThan(100);
    });

    it('Random sweep', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M);
        const transmitter = dtm.sweepTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 0, 39, 20, 0, true);
        const recv = await dtmReceiver.sweepReceiverTest(0, 39, 20, 3000, true);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toBeGreaterThan(0);
    });

    it('Non overlapping sequential sweeps returns no packets.', async () => {
        await dtm.setupReset();
        await dtmReceiver.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M);
        const transmitter = dtm.sweepTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 0, 20, 20, 0);
        const recv = await dtmReceiver.sweepReceiverTest(21, 39, 20, 3000);
        dtm.endTest();
        await transmitter;
        expect(recv.success).toEqual(true);
        expect(recv.received).toEqual(0);
    });

    it('Perform 30 sweepTransmitterTests', async () => {
        await dtm.setupReset();
        await dtm.setupPhy(DTM.DTM.DTM_PARAMETER.PHY_LE_1M);
        for (let i = 0; i < 30; i++) {
            const response = await dtm.sweepTransmitterTest(DTM.DTM.DTM_PKT.PAYLOAD_PRBS9, 1, 0, 39, 20, 100);
            expect(response.success).toEqual(true);
        }
    });

    it('Perform 30 sweepReceiverTests', async () => {
        await dtm.setupReset();
        for (let i = 0; i < 30; i++) {
            const response = await dtm.sweepReceiverTest(0, 39, 20, 100);
            expect(response.success).toEqual(true);
        }
    });
});
