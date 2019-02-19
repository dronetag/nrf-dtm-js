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

import SerialPort from 'serialport';
import Debug from 'debug';

const debug = Debug('dtm');

// 2 bits
const DTM_CMD= {
    TEST_SETUP: '00',
    RECEIVER_TEST: '01',
    TRANSMITTER_TEST: '10',
    TEST_END: '11',
};

// 6 bits
const DTM_CONTRAL = {
    RESET: '000000',
    ENABLE_LENGTH: '000001',
    PHY: '000010',
    MODULATION: '000011',
    FEATURES: '000100',
    TXRX: '000101',
};

// 6 bits
const DTM_FREQUENCY = f => {
    console.log('test');
    return ((f - 2402) / 2).toString(2).padStart(6, '0');
};

// 2 bits
const DTM_PKT = {
    PAYLOAD_PRBS9: '00',
    PAYLOAD_11110000: '01',
    PAYLOAD_10101010: '10',
    PAYLOAD_VENDER: '11',
}

class DTM {
    constructor(comName) {
        this.port = new SerialPort(comName, { autoOpen: false, baudRate: 19200 });
        this.addListeners();
        this.open();
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
                    debug('Unexpected data length: ', data.length);
                }
            } else {
                debug('Unhandled data: ', data);
            }
        });
        this.port.on('error', error => {
            console.log(error);
        });
        this.port.on('open', () => {
            console.log('open');
        });
    }

    open() {
        this.port.open(() => {
            console.log('opened');
        });
    }

    close() {
        this.port.close(() => {});
    }

    sendCMD(bytes) {
        this.port.write(bytes);
        return new Promise(res => {
            this.callback = data => {
                console.log('callback');
                this.callback = undefined;
                debug(data);
                res(data);
            };
        });
    }

    async reset() {
        return await this.sendCMD([0x20, 0x00]);
    }

    start() {
        this.sendCMD([0x80, 0x94]);
    }

    stop() {
        this.sendCMD([0xC0, 0x00]);
    }
}

export {
    DTM,
    DTM_CMD,
    DTM_CONTRAL,
    DTM_FREQUENCY,
};
