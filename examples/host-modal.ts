import { createPort } from '../src';

const port = createPort({
  url: 'https://example.com/checkout',
  allowedOrigin: 'https://example.com',
  target: '#modal-root',
  mode: 'modal'
});

await port.mount();
await port.open();

// Later
await port.close();
