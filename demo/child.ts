import { createChildPort } from '../src/child';

const originValue = document.querySelector<HTMLElement>('#child-origin');
const tickValue = document.querySelector<HTMLElement>('#child-ticks');
const pingValue = document.querySelector<HTMLElement>('#child-ping');

if (!originValue || !tickValue || !pingValue) {
  throw new Error('Child demo is missing required elements');
}

const child = createChildPort({
  allowedOrigin: window.location.origin
});

let tickCount = 0;

function updateHeight(): void {
  child.resize(document.documentElement.scrollHeight);
}

child.on('request:system:ping', (message: unknown) => {
  const request = message as { messageId: string; payload?: { requestedAt?: string } };
  const receivedAt = new Date().toISOString();

  pingValue.textContent = request.payload?.requestedAt ?? 'received';
  child.respond(request.messageId, {
    ok: true,
    receivedAt
  });
});

setTimeout(() => {
  const payload = {
    mode: 'child',
    sentAt: new Date().toISOString()
  };

  originValue.textContent = window.location.origin;
  child.emit('demo:ready', payload);
  child.emit('widget:loaded', {
    version: '1',
    protocol: 'crup.port'
  });
  updateHeight();
}, 150);

window.setInterval(() => {
  tickCount += 1;
  tickValue.textContent = String(tickCount);
  child.emit('telemetry:tick', {
    count: tickCount,
    sentAt: new Date().toISOString()
  });
  updateHeight();
}, 2_000);

window.addEventListener('resize', updateHeight);
updateHeight();
