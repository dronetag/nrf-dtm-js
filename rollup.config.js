import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';

export default [
    {
        input: 'src/index.js',
        external: [
            'debug',
            'events',
            'fs',
            'serialport',
        ],
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true,
            },
        ],
        plugins: [
            eslint(),
        ],
    },
];
