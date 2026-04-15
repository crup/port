import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createChildPort } from '../src/child';
import { PortError } from '../src/errors';
import { createPort } from '../src/host';
import type { PortMessage } from '../src/types';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function setupTarget(id = 'root') {
  const target = document.createElement('div');
  target.id = id;
  document.body.append(target);
  return target;
}

describe('lifecycle', () => {
  it('mounts and reaches open in inline mode', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 50,
      iframeLoadTimeoutMs: 50
    });

    const mounting = port.mount();
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();

    const childWindow = iframe.contentWindow as Window;
    vi.spyOn(childWindow, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: childWindow,
            data: {
              protocol: 'crup.port',
              version: '1',
              instanceId: hello.instanceId,
              messageId: 'ready_1',
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    iframe.dispatchEvent(new Event('load'));
    await expect(mounting).resolves.toBeUndefined();
    expect(port.getState()).toBe('open');
  });

  it('rejects double mount with INVALID_STATE', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 10,
      iframeLoadTimeoutMs: 10
    });

    const first = port.mount();
    await expect(port.mount()).rejects.toMatchObject({ code: 'INVALID_STATE' });
    (document.querySelector('iframe') as HTMLIFrameElement).dispatchEvent(new Event('load'));
    await expect(first).rejects.toBeInstanceOf(PortError);
  });

  it('cleans up failed mounts and allows a retry', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 10,
      iframeLoadTimeoutMs: 20
    });

    const firstMount = port.mount();
    const firstFrame = document.querySelector('iframe') as HTMLIFrameElement;
    firstFrame.dispatchEvent(new Event('load'));

    await expect(firstMount).rejects.toMatchObject({ code: 'HANDSHAKE_TIMEOUT' });
    expect(port.getState()).toBe('idle');
    expect(document.querySelector('iframe')).toBeNull();

    const secondMount = port.mount();
    const secondFrame = document.querySelector('iframe') as HTMLIFrameElement;
    const childWindow = secondFrame.contentWindow as Window;

    vi.spyOn(childWindow, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: childWindow,
            data: {
              ...hello,
              messageId: 'ready_retry',
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    secondFrame.dispatchEvent(new Event('load'));
    await expect(secondMount).resolves.toBeUndefined();
    expect(port.getState()).toBe('open');
  });
});

describe('messaging and rpc', () => {
  it('rejects handshake when messages arrive from wrong origin', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 20,
      iframeLoadTimeoutMs: 20
    });

    const mounting = port.mount();
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;

    const childWindow = iframe.contentWindow as Window;
    vi.spyOn(childWindow, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://evil.example.com',
            source: childWindow,
            data: {
              ...hello,
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    iframe.dispatchEvent(new Event('load'));
    await expect(mounting).rejects.toMatchObject({ code: 'HANDSHAKE_TIMEOUT' });
  });

  it('times out pending RPC call', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 50,
      iframeLoadTimeoutMs: 50,
      callTimeoutMs: 20
    });

    const mounting = port.mount();
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;

    const childWindow = iframe.contentWindow as Window;
    vi.spyOn(childWindow, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: childWindow,
            data: {
              protocol: 'crup.port',
              version: '1',
              instanceId: hello.instanceId,
              messageId: 'ready_2',
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    iframe.dispatchEvent(new Event('load'));
    await mounting;

    await expect(port.call('data:get')).rejects.toMatchObject({ code: 'CALL_TIMEOUT' });
  });

  it('supports multiple host ports without cross-talk', async () => {
    const one = createPort({
      url: 'https://child.example.com/one',
      allowedOrigin: 'https://child.example.com',
      target: setupTarget('one'),
      handshakeTimeoutMs: 50,
      iframeLoadTimeoutMs: 50
    });

    const two = createPort({
      url: 'https://child.example.com/two',
      allowedOrigin: 'https://child.example.com',
      target: setupTarget('two'),
      handshakeTimeoutMs: 50,
      iframeLoadTimeoutMs: 50
    });

    const mountOne = one.mount();
    const iframeOne = document.querySelector('#one iframe') as HTMLIFrameElement;
    const winOne = iframeOne.contentWindow as Window;

    vi.spyOn(winOne, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: winOne,
            data: {
              ...hello,
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    iframeOne.dispatchEvent(new Event('load'));
    await mountOne;

    const mountTwo = two.mount();
    const iframeTwo = document.querySelector('#two iframe') as HTMLIFrameElement;
    const winTwo = iframeTwo.contentWindow as Window;

    vi.spyOn(winTwo, 'postMessage').mockImplementation((data: unknown) => {
      const hello = data as PortMessage;
      if (hello.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: winTwo,
            data: {
              ...hello,
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
      }
    });

    iframeTwo.dispatchEvent(new Event('load'));
    await mountTwo;

    expect(one.getState()).toBe('open');
    expect(two.getState()).toBe('open');
  });
});

describe('child runtime', () => {
  it('requires an explicit child allowedOrigin', () => {
    expect(() => createChildPort({} as never)).toThrowError(PortError);
  });

  it('routes host requests into request:* events only after hello', async () => {
    const child = createChildPort({ allowedOrigin: 'https://host.example.com' });
    const handler = vi.fn();
    child.on('request:data:get', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://host.example.com',
        source: window.parent,
        data: {
          protocol: 'crup.port',
          version: '1',
          instanceId: 'inst_1',
          messageId: 'hello_1',
          kind: 'system',
          type: 'port:hello'
        }
      })
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://host.example.com',
        source: window.parent,
        data: {
          protocol: 'crup.port',
          version: '1',
          instanceId: 'inst_1',
          messageId: 'req_1',
          kind: 'request',
          type: 'data:get',
          payload: { id: 1 }
        }
      })
    );

    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    child.destroy();
  });

  it('converts child reject() into a host MESSAGE_REJECTED error', async () => {
    const target = setupTarget();
    const port = createPort({
      url: 'https://child.example.com',
      allowedOrigin: 'https://child.example.com',
      target,
      handshakeTimeoutMs: 50,
      iframeLoadTimeoutMs: 50,
      callTimeoutMs: 50
    });

    const mounting = port.mount();
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    const childWindow = iframe.contentWindow as Window;
    const postMessage = vi.spyOn(childWindow, 'postMessage');

    postMessage.mockImplementation((data: unknown) => {
      const message = data as PortMessage;

      if (message.type === 'port:hello') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: childWindow,
            data: {
              ...message,
              messageId: 'ready_reject',
              kind: 'system',
              type: 'port:ready'
            }
          })
        );
        return;
      }

      if (message.kind === 'request') {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://child.example.com',
            source: childWindow,
            data: {
              protocol: 'crup.port',
              version: '1',
              instanceId: message.instanceId,
              messageId: 'err_1',
              replyTo: message.messageId,
              kind: 'error',
              type: 'port:error',
              payload: 'Quote unavailable'
            }
          })
        );
      }
    });

    iframe.dispatchEvent(new Event('load'));
    await mounting;

    await expect(port.call('demo:getQuote')).rejects.toMatchObject({
      code: 'MESSAGE_REJECTED',
      message: 'Quote unavailable'
    });
  });
});
