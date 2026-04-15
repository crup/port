import { createChildPort } from '../src/child';

const child = createChildPort();

child.on('request:data:get', (message) => {
  const request = message as { messageId: string; payload: { id: string } };
  child.respond(request.messageId, {
    id: request.payload.id,
    status: 'ok'
  });
});

child.emit('widget:loaded', { timestamp: Date.now() });
child.resize(document.body.scrollHeight);
