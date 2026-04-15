import { createPort } from '../src/index';

type DemoPort = ReturnType<typeof createPort>;

interface DemoContext {
  workspace: string;
  accent: 'amber' | 'mint' | 'blue';
  focus: string;
}

interface PingResponse {
  ok: boolean;
  receivedAt: string;
  activePlan: string;
}

interface QuoteResponse {
  plan: string;
  price: number;
  currency: string;
  cycle: string;
  responseAt: string;
}

interface PlanChangedPayload {
  plan: string;
  price: number;
  currency: string;
  cycle: string;
  updatedAt: string;
}

interface ContextAppliedPayload extends DemoContext {
  appliedAt: string;
}

const stateValue = document.querySelector<HTMLElement>('#state-value');
const originValue = document.querySelector<HTMLElement>('#origin-value');
const rpcValue = document.querySelector<HTMLElement>('#rpc-value');
const planValue = document.querySelector<HTMLElement>('#plan-value');
const contextValue = document.querySelector<HTMLElement>('#context-value');
const eventCountValue = document.querySelector<HTMLElement>('#event-count');
const eventLog = document.querySelector<HTMLOListElement>('#event-log');
const mountTarget = document.querySelector<HTMLElement>('#demo-root');
const mountButton = document.querySelector<HTMLButtonElement>('#mount-button');
const pingButton = document.querySelector<HTMLButtonElement>('#ping-button');
const quoteButton = document.querySelector<HTMLButtonElement>('#quote-button');
const contextButton = document.querySelector<HTMLButtonElement>('#context-button');
const revealTargets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

if (
  !stateValue ||
  !originValue ||
  !rpcValue ||
  !planValue ||
  !contextValue ||
  !eventCountValue ||
  !eventLog ||
  !mountTarget ||
  !mountButton ||
  !pingButton ||
  !quoteButton ||
  !contextButton
) {
  throw new Error('Demo shell is missing required elements');
}

const stateNode = stateValue;
const originNode = originValue;
const rpcNode = rpcValue;
const planNode = planValue;
const contextNode = contextValue;
const eventCountNode = eventCountValue;
const logNode = eventLog;
const mountNode = mountTarget;
const remountButton = mountButton;
const pingRpcButton = pingButton;
const quoteRpcButton = quoteButton;
const sendContextButton = contextButton;

const contexts: DemoContext[] = [
  { workspace: 'Growth review', accent: 'amber', focus: 'Renewal pricing' },
  { workspace: 'Support handoff', accent: 'blue', focus: 'Customer status' },
  { workspace: 'Ops audit', accent: 'mint', focus: 'Session quality' }
];

let port: DemoPort | null = null;
let contextIndex = 0;
let childEventCount = 0;

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
  { threshold: 0.18 }
);

for (const element of revealTargets) {
  revealObserver.observe(element);
}

function setControlsDisabled(disabled: boolean): void {
  pingRpcButton.disabled = disabled;
  quoteRpcButton.disabled = disabled;
  sendContextButton.disabled = disabled;
}

function setStateLabel(value: string): void {
  stateNode.textContent = value;
}

function appendLog(channel: 'host' | 'child' | 'system' | 'error', title: string, detail: string): void {
  const item = document.createElement('li');
  item.className = 'log-entry';
  item.dataset.channel = channel;

  const meta = document.createElement('div');
  meta.className = 'log-meta';

  const channelNode = document.createElement('span');
  channelNode.className = 'log-channel';
  channelNode.textContent = channel;

  const titleNode = document.createElement('strong');
  titleNode.textContent = title;

  meta.append(channelNode, titleNode);

  const detailNode = document.createElement('p');
  detailNode.textContent = detail;

  item.append(meta, detailNode);
  logNode.prepend(item);

  while (logNode.children.length > 10) {
    logNode.lastElementChild?.remove();
  }
}

function incrementChildEvent(): void {
  childEventCount += 1;
  eventCountNode.textContent = String(childEventCount).padStart(2, '0');
}

function updateFromPlan(payload: Pick<QuoteResponse, 'plan' | 'price' | 'currency' | 'cycle'>): void {
  planNode.textContent = `${payload.plan} · ${payload.currency} ${payload.price}${payload.cycle}`;
}

function createDemoPort(): DemoPort {
  const childUrl = new URL('./child.html', window.location.href).toString();

  return createPort({
    url: childUrl,
    allowedOrigin: window.location.origin,
    target: mountNode,
    mode: 'inline',
    minHeight: 360,
    maxHeight: 620,
    handshakeTimeoutMs: 3_000
  });
}

function bindPort(nextPort: DemoPort): void {
  nextPort.on('demo:ready', (payload: unknown) => {
    incrementChildEvent();
    appendLog('child', 'demo:ready', JSON.stringify(payload));
    setStateLabel(nextPort.getState());
  });

  nextPort.on('widget:loaded', (payload: unknown) => {
    incrementChildEvent();
    appendLog('child', 'widget:loaded', JSON.stringify(payload));
  });

  nextPort.on('telemetry:tick', (payload: unknown) => {
    incrementChildEvent();
    const tick = payload as { count: number; plan: string; sentAt: string };
    appendLog('child', 'telemetry:tick', `#${tick.count} · ${tick.plan} · ${new Date(tick.sentAt).toLocaleTimeString()}`);
  });

  nextPort.on('demo:planChanged', (payload: unknown) => {
    incrementChildEvent();
    const plan = payload as PlanChangedPayload;
    updateFromPlan(plan);
    appendLog('child', 'demo:planChanged', `${plan.plan} · ${plan.currency} ${plan.price}${plan.cycle}`);
  });

  nextPort.on('demo:contextApplied', (payload: unknown) => {
    incrementChildEvent();
    const context = payload as ContextAppliedPayload;
    contextNode.textContent = `${context.workspace} · ${context.focus}`;
    appendLog('child', 'demo:contextApplied', `${context.workspace} · ${context.accent}`);
  });
}

async function runPing(reason = 'manual'): Promise<void> {
  if (!port) {
    return;
  }

  rpcNode.textContent = 'pending';
  appendLog('host', 'request system:ping', reason);

  try {
    const result = await port.call<PingResponse>('system:ping', {
      requestedAt: new Date().toISOString(),
      reason
    });

    rpcNode.textContent = `ok · ${new Date(result.receivedAt).toLocaleTimeString()}`;
    planNode.textContent = result.activePlan;
    appendLog('child', 'response system:ping', `${result.activePlan} · ${result.receivedAt}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown ping error';
    rpcNode.textContent = 'failed';
    appendLog('error', 'response system:ping', message);
  }
}

async function requestQuote(trigger = 'manual'): Promise<void> {
  if (!port) {
    return;
  }

  appendLog('host', 'request demo:getQuote', trigger);

  try {
    const result = await port.call<QuoteResponse>('demo:getQuote', {
      trigger,
      requestedAt: new Date().toISOString()
    });

    updateFromPlan(result);
    appendLog('child', 'response demo:getQuote', `${result.plan} · ${result.currency} ${result.price}${result.cycle}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown quote error';
    appendLog('error', 'response demo:getQuote', message);
  }
}

function sendContext(): void {
  if (!port) {
    return;
  }

  const nextContext = contexts[contextIndex % contexts.length];
  contextIndex += 1;

  contextNode.textContent = `${nextContext.workspace} · ${nextContext.focus}`;
  appendLog('host', 'event demo:hostContext', `${nextContext.workspace} · ${nextContext.accent}`);
  port.send('demo:hostContext', nextContext);
}

async function mountSession(): Promise<void> {
  setControlsDisabled(true);

  if (port) {
    port.destroy();
  }

  childEventCount = 0;
  eventCountNode.textContent = '00';
  rpcNode.textContent = 'none';
  planNode.textContent = 'loading';
  contextNode.textContent = 'standby';
  mountNode.replaceChildren();

  const nextPort = createDemoPort();
  port = nextPort;
  bindPort(nextPort);

  originNode.textContent = window.location.origin;
  setStateLabel('mounting');
  appendLog('system', 'mount', 'creating new iframe session');

  try {
    await nextPort.mount();
    setStateLabel(nextPort.getState());
    appendLog('system', 'state', nextPort.getState());
    setControlsDisabled(false);
    await runPing('warmup');
    await requestQuote('initial');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown mount error';
    setStateLabel('failed');
    rpcNode.textContent = 'failed';
    appendLog('error', 'mount', message);
  }
}

remountButton.addEventListener('click', () => {
  void mountSession();
});

pingRpcButton.addEventListener('click', () => {
  void runPing();
});

quoteRpcButton.addEventListener('click', () => {
  void requestQuote();
});

sendContextButton.addEventListener('click', () => {
  sendContext();
});

originNode.textContent = window.location.origin;
setStateLabel('idle');
void mountSession();
