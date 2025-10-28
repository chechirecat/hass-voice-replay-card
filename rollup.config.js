import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';

const dev = process.env.ROLLUP_WATCH;
const serve_env = process.env.SERVE;

export default {
  input: 'voice-replay-card.js',
  output: {
    file: 'dist/voice-replay-card.js',
    format: 'es',
    sourcemap: dev
  },
  plugins: [
    !dev && terser(),
    serve_env && serve({
      contentBase: ['dist'],
      host: '0.0.0.0',
      port: 5000,
      allowCrossOrigin: true,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    })
  ].filter(Boolean)
};