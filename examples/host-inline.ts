import { createPort } from '../src';

const port = createPort({
  url: 'https://example.com/embed',
  allowedOrigin: 'https://example.com',
  target: '#app',
  mode: 'inline'
});

await port.mount();

port.on('action:done', (payload) => {
  console.log('action:done', payload);
});
