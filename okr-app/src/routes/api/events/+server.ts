import type { RequestHandler } from './$types';
import { addClient, removeClient } from '$lib/server/events';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const userId = locals.user.id;
	let clientInfo: ReturnType<typeof addClient> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			clientInfo = addClient(userId, controller);

			// Send initial connection confirmation
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));
		},
		cancel() {
			if (clientInfo) {
				removeClient(userId, clientInfo);
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no' // Disable nginx buffering
		}
	});
};
