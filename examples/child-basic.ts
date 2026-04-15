import { createChildPort } from '../src/child';

const child = createChildPort({
  allowedOrigin: 'https://host.example.com'
});

child.on('request:data:get', (message) => {
  const request = message as { messageId: string; payload: { id: string } };

  if (!request.payload?.id) {
    child.reject(request.messageId, {
      code: 'missing_id',
      message: 'id is required'
    });
    return;
  }

  child.respond(request.messageId, {
    id: request.payload.id,
    status: 'ok'
  });
});

child.emit('widget:loaded', { timestamp: Date.now() });
child.resize(document.body.scrollHeight);
