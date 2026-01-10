// Server-Sent Events broadcasting system for real-time sync across devices

type EventController = ReadableStreamDefaultController<Uint8Array>;

interface ClientInfo {
	controller: EventController;
	heartbeatInterval: ReturnType<typeof setInterval>;
}

// Store for connected clients, keyed by user ID
const clients = new Map<string, Set<ClientInfo>>();

const encoder = new TextEncoder();

export function addClient(userId: string, controller: EventController): ClientInfo {
	if (!clients.has(userId)) {
		clients.set(userId, new Set());
	}

	// Set up heartbeat to keep connection alive
	const heartbeatInterval = setInterval(() => {
		try {
			controller.enqueue(encoder.encode(': heartbeat\n\n'));
		} catch {
			// Client disconnected, cleanup will happen via cancel
		}
	}, 30000);

	const clientInfo: ClientInfo = { controller, heartbeatInterval };
	clients.get(userId)!.add(clientInfo);

	return clientInfo;
}

export function removeClient(userId: string, clientInfo: ClientInfo) {
	clearInterval(clientInfo.heartbeatInterval);
	clients.get(userId)?.delete(clientInfo);

	// Clean up empty user sets
	if (clients.get(userId)?.size === 0) {
		clients.delete(userId);
	}
}

export function broadcast(userId: string, eventType: string) {
	const userClients = clients.get(userId);
	if (!userClients || userClients.size === 0) return;

	const message = `data: ${JSON.stringify({ type: eventType })}\n\n`;
	const encoded = encoder.encode(message);

	for (const clientInfo of userClients) {
		try {
			clientInfo.controller.enqueue(encoded);
		} catch {
			// Client disconnected, will be cleaned up
			removeClient(userId, clientInfo);
		}
	}
}

// Broadcast to all event types that a page might depend on
export function broadcastDataChange(userId: string, ...eventTypes: string[]) {
	for (const eventType of eventTypes) {
		broadcast(userId, eventType);
	}
}
