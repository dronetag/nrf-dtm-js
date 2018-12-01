import eslint from 'rollup-plugin-eslint';
import pkg from './package.json';

export default [
    {
        input: 'src/index.js',
        external: ['fs', 'debug', 'serialport'],
        output: [
            { file: pkg.main, format: 'cjs', sourcemap: true },
        ],
        plugins: [
            eslint(),
        ]
    }
];
