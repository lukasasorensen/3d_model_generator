/**
 * SSE (Server-Sent Events) Parser Utility
 * Parses SSE event streams into structured event objects.
 */

export interface ParsedSSEEvent {
  eventType: string;
  data: Record<string, unknown>;
}

/**
 * Parse SSE events from a chunk of data.
 * Handles both named events (event: type\ndata: json) and simple data events (data: json with type inside)
 */
export function parseSSEEvents(chunk: string): ParsedSSEEvent[] {
  const events: ParsedSSEEvent[] = [];
  const lines = chunk.split('\n');

  let currentEventType: string | null = null;
  let currentData: string | null = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // Named event - store the event type
      currentEventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      // Data line
      currentData = line.slice(6);

      try {
        const parsedData = JSON.parse(currentData);

        // If we have a named event type, use it; otherwise fall back to type in data
        const eventType = currentEventType || parsedData.type;

        if (eventType) {
          events.push({
            eventType,
            data: parsedData
          });
        }
      } catch (e) {
        // JSON parse error - skip this event
        if (!(e instanceof SyntaxError)) {
          throw e;
        }
      }

      // Reset for next event
      currentEventType = null;
      currentData = null;
    } else if (line === '') {
      // Empty line marks end of an event - reset state
      currentEventType = null;
      currentData = null;
    }
  }

  return events;
}
