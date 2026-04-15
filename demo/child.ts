import { createChildPort } from '../src/child';

type PlanKey = 'starter' | 'growth' | 'scale';

interface DemoContext {
  workspace?: string;
  accent?: 'amber' | 'mint' | 'blue';
  focus?: string;
}

const plans = {
  starter: { label: 'Starter', price: 79, currency: 'USD', cycle: '/mo' },
  growth: { label: 'Growth', price: 249, currency: 'USD', cycle: '/mo' },
  scale: { label: 'Scale', price: 799, currency: 'USD', cycle: '/mo' }
} as const;

const originValue = document.querySelector<HTMLElement>('#child-origin');
const workspaceValue = document.querySelector<HTMLElement>('#child-workspace');
const tickValue = document.querySelector<HTMLElement>('#child-ticks');
const pingValue = document.querySelector<HTMLElement>('#child-ping');
const planValue = document.querySelector<HTMLElement>('#child-plan');
const priceValue = document.querySelector<HTMLElement>('#child-price');
const focusValue = document.querySelector<HTMLElement>('#child-focus');
const activityLog = document.querySelector<HTMLOListElement>('#child-activity');
const resizeStateValue = document.querySelector<HTMLElement>('#resize-state');
const resizeToggleButton = document.querySelector<HTMLButtonElement>('#resize-toggle');
const resizePanel = document.querySelector<HTMLElement>('#resize-panel');
const planButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-plan-button]'));

if (
  !originValue ||
  !workspaceValue ||
  !tickValue ||
  !pingValue ||
  !planValue ||
  !priceValue ||
  !focusValue ||
  !activityLog ||
  !resizeStateValue ||
  !resizeToggleButton ||
  !resizePanel ||
  planButtons.length === 0
) {
  throw new Error('Child demo is missing required elements');
}

const originNode = originValue;
const workspaceNode = workspaceValue;
const tickNode = tickValue;
const pingNode = pingValue;
const planNode = planValue;
const priceNode = priceValue;
const focusNode = focusValue;
const activityNode = activityLog;
const resizeStateNode = resizeStateValue;
const resizeButton = resizeToggleButton;
const resizePanelNode = resizePanel;

const child = createChildPort({
  allowedOrigin: window.location.origin
});

let selectedPlan: PlanKey = 'growth';
let tickCount = 0;
let isResizeExpanded = false;
let currentContext: Required<DemoContext> = {
  workspace: 'Waiting for host context',
  accent: 'amber',
  focus: 'No host event has been sent yet.'
};

function appendActivity(message: string): void {
  const item = document.createElement('li');
  item.textContent = message;
  activityNode.prepend(item);

  while (activityNode.children.length > 6) {
    activityNode.lastElementChild?.remove();
  }
}

function syncHeight(): void {
  window.requestAnimationFrame(() => {
    child.resize(document.documentElement.scrollHeight);
  });
}

function getQuotePayload() {
  const plan = plans[selectedPlan];

  return {
    plan: plan.label,
    price: plan.price,
    currency: plan.currency,
    cycle: plan.cycle,
    responseAt: new Date().toISOString()
  };
}

function updatePlanSurface(): void {
  const payload = getQuotePayload();
  planNode.textContent = payload.plan;
  priceNode.textContent = `${payload.currency} ${payload.price}${payload.cycle}`;
  focusNode.textContent = `Focus area: ${currentContext.focus}`;
  document.documentElement.dataset.accent = currentContext.accent;

  for (const button of planButtons) {
    button.classList.toggle('is-active', button.dataset.planButton === selectedPlan);
  }
}

function emitPlanChange(): void {
  const payload = {
    ...getQuotePayload(),
    updatedAt: new Date().toISOString()
  };

  child.emit('demo:planChanged', payload);
}

function syncResizeSurface(): void {
  resizeStateNode.textContent = isResizeExpanded ? 'expanded' : 'compact';
  resizeButton.textContent = isResizeExpanded ? 'Collapse resize content' : 'Expand resize content';
  resizeButton.setAttribute('aria-expanded', String(isResizeExpanded));
  resizePanelNode.hidden = !isResizeExpanded;
}

child.on('request:system:ping', (message: unknown) => {
  const request = message as { messageId: string; payload?: { requestedAt?: string } };
  const receivedAt = new Date().toISOString();

  pingNode.textContent = request.payload?.requestedAt ?? receivedAt;
  appendActivity(`responded to ping at ${new Date(receivedAt).toLocaleTimeString()}`);

  child.respond(request.messageId, {
    ok: true,
    receivedAt,
    activePlan: `${getQuotePayload().plan} · ${getQuotePayload().currency} ${getQuotePayload().price}${getQuotePayload().cycle}`
  });

  syncHeight();
});

child.on('request:demo:getQuote', (message: unknown) => {
  const request = message as { messageId: string };
  const payload = getQuotePayload();

  appendActivity(`returned quote for ${payload.plan}`);
  child.respond(request.messageId, payload);
});

child.on('demo:hostContext', (payload: unknown) => {
  const nextContext = payload as DemoContext;

  currentContext = {
    workspace: nextContext.workspace ?? currentContext.workspace,
    accent: nextContext.accent ?? currentContext.accent,
    focus: nextContext.focus ?? currentContext.focus
  };

  workspaceNode.textContent = currentContext.workspace;
  updatePlanSurface();
  appendActivity(`applied host context: ${currentContext.workspace}`);

  child.emit('demo:contextApplied', {
    ...currentContext,
    appliedAt: new Date().toISOString()
  });

  syncHeight();
});

for (const button of planButtons) {
  button.addEventListener('click', () => {
    selectedPlan = button.dataset.planButton as PlanKey;
    updatePlanSurface();
    appendActivity(`selected ${plans[selectedPlan].label}`);
    emitPlanChange();
    syncHeight();
  });
}

resizeButton.addEventListener('click', () => {
  isResizeExpanded = !isResizeExpanded;
  syncResizeSurface();
  appendActivity(`resize demo ${isResizeExpanded ? 'expanded' : 'collapsed'}`);
  child.emit('demo:resizeModeChanged', {
    mode: isResizeExpanded ? 'expanded' : 'compact',
    changedAt: new Date().toISOString()
  });
  syncHeight();
});

window.setTimeout(() => {
  originNode.textContent = window.location.origin;
  workspaceNode.textContent = currentContext.workspace;
  updatePlanSurface();
  syncResizeSurface();

  child.emit('demo:ready', {
    child: 'pricing-widget',
    plan: plans[selectedPlan].label,
    capabilities: ['system:ping', 'demo:getQuote', 'demo:hostContext']
  });
  child.emit('widget:loaded', {
    surface: 'pricing-widget',
    protocol: 'crup.port',
    version: '1'
  });
  emitPlanChange();
  appendActivity('child runtime became ready');
  syncHeight();
}, 180);

window.setInterval(() => {
  tickCount += 1;
  tickNode.textContent = String(tickCount);
  child.emit('telemetry:tick', {
    count: tickCount,
    plan: plans[selectedPlan].label,
    sentAt: new Date().toISOString()
  });
}, 4_000);

window.addEventListener('resize', syncHeight);
updatePlanSurface();
syncHeight();
