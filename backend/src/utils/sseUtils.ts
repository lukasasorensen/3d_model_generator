import { Response } from "express";
import { OpenScadStreamEvent } from "../services/openScadAiService";

export const SSE_EVENTS = {
  conversationCreated: "conversation_created",
  generationStart: "generation_start",
  codeDelta: "code_delta",
  reasoningDelta: "reasoning_delta",
  toolCallStart: "tool_call_start",
  toolCallDelta: "tool_call_delta",
  toolCallEnd: "tool_call_end",
  codeComplete: "code_complete",
  generationError: "generation_error",
  compiling: "compiling",
  outputting: "outputting",
  validating: "validating",
  completed: "completed",
  error: "error",
} as const;

export type SseEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];

export const setSseHeaders = (res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
};

export const writeSse = (
  res: Response,
  eventType: SseEventType,
  data: unknown
): void => {
  res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
};

export const writeAiStreamEvent = (
  res: Response,
  event: OpenScadStreamEvent
): void => {
  switch (event.type) {
    case "code_delta":
      writeSse(res, SSE_EVENTS.codeDelta, { chunk: event.delta });
      break;

    case "reasoning_delta":
      writeSse(res, SSE_EVENTS.reasoningDelta, { chunk: event.delta });
      break;

    case "tool_call_start":
      writeSse(res, SSE_EVENTS.toolCallStart, {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });
      break;

    case "tool_call_delta":
      writeSse(res, SSE_EVENTS.toolCallDelta, {
        toolCallId: event.toolCallId,
        argumentsDelta: event.argumentsDelta,
      });
      break;

    case "tool_call_end":
      writeSse(res, SSE_EVENTS.toolCallEnd, {
        toolCallId: event.toolCallId,
        arguments: event.arguments,
      });
      break;

    case "done":
      writeSse(res, SSE_EVENTS.codeComplete, {
        code: event.totalCode,
        usage: event.usage,
      });
      break;

    case "error":
      writeSse(res, SSE_EVENTS.generationError, {
        error: event.error,
        code: event.code,
      });
      break;
  }
};
