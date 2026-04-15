import { createPort } from '../src/index';

const stateValue = document.querySelector<HTMLElement>('#state-value');
const originValue = document.querySelector<HTMLElement>('#origin-value');
const rpcValue = document.querySelector<HTMLElement>('#rpc-value');
const eventLog = document.querySelector<HTMLOListElement>('#event-log');
const mountTarget = document.querySelector<HTMLElement>('#demo-root');
const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

if (!stateValue || !originValue || !rpcValue || !eventLog || !mountTarget) {
  throw new Error('Demo shell is missing required elements');
}

const stateNode = stateValue;
const originNode = originValue;
const rpcNode = rpcValue;
const logNode = eventLog;
const mountNode = mountTarget;

for (const element of revealTargets) {
  element.classList.add('is-hidden');
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    }
  },
  { threshold: 0.2 }
);

for (const element of revealTargets) {
  revealObserver.observe(element);
}

function appendLog(message: string): void {
  const item = document.createElement('li');
  item.textContent = message;
  logNode.prepend(item);

  while (logNode.children.length > 6) {
    logNode.lastElementChild?.remove();
  }
}

const childUrl = new URL('./child.html', window.location.href).toString();
const port = createPort({
  url: childUrl,
  allowedOrigin: window.location.origin,
  target: mountNode,
  mode: 'inline',
  minHeight: 300,
  maxHeight: 520,
  handshakeTimeoutMs: 3_000
});

stateNode.textContent = port.getState();
originNode.textContent = window.location.origin;

port.on('demo:ready', (payload: unknown) => {
  appendLog(`child ready ${JSON.stringify(payload)}`);
  stateNode.textContent = port.getState();
});

port.on('telemetry:tick', (payload: unknown) => {
  const tick = payload as { count: number; sentAt: string };
  appendLog(`tick ${tick.count} at ${new Date(tick.sentAt).toLocaleTimeString()}`);
});

port.on('widget:loaded', (payload: unknown) => {
  appendLog(`widget loaded ${JSON.stringify(payload)}`);
});

async function bootstrap(): Promise<void> {
  appendLog('mounting host iframe');
  await port.mount();
  stateNode.textContent = port.getState();
  appendLog(`state -> ${port.getState()}`);

  const result = await port.call<{ ok: boolean; receivedAt: string }>('system:ping', {
    requestedAt: new Date().toISOString()
  });

  rpcNode.textContent = result.ok ? 'ping ok' : 'ping failed';
  appendLog(`rpc response ${result.receivedAt}`);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown demo error';
  rpcNode.textContent = 'failed';
  appendLog(`error ${message}`);
});
