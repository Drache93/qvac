import assert from "node:assert/strict";
import {
  InferenceCancelledError,
  createBrowserClient,
} from "@qvac/sdk-browser";

let activeId;
let cancelled = false;
let release = () => {};
const gate = new Promise((resolve) => {
  release = resolve;
});
const calls = [];
const client = createBrowserClient({
  runtime: {
    async loadModel(options) {
      calls.push(["load", options]);
      return "model";
    },
    async *streamCompletion(request) {
      activeId = request.requestId;
      yield {
        type: "completionStream",
        events: [{ type: "contentDelta", seq: 0, text: "Hello" }],
      };
      if (request.history[0].content === "cancel") await gate;
      yield {
        type: "completionStream",
        done: true,
        events: [
          {
            type: "completionDone",
            seq: 1,
            stopReason: cancelled ? "cancelled" : "eos",
            raw: { fullText: "Hello" },
          },
        ],
      };
    },
    async cancel(options) {
      assert.equal(options.requestId, activeId);
      cancelled = true;
      release();
    },
    async unloadModel(options) {
      calls.push(["unload", options]);
    },
    close() {
      calls.push(["close"]);
    },
  },
});
await client.loadModel({
  modelSrc: "https://example.com/model.gguf",
  ctxSize: 512,
});
const run = client.completion({
  modelId: "model",
  history: [{ role: "user", content: "Hi" }],
});
const events = [];
for await (const event of run.events) events.push(event);
assert.equal((await run.final).contentText, "Hello");
assert.equal(events.at(-1).type, "completionDone");
assert.equal(run.requestId, activeId);
const cancellation = client.completion({
  modelId: "model",
  history: [{ role: "user", content: "cancel" }],
});
const iterator = cancellation.events[Symbol.asyncIterator]();
await iterator.next();
await client.cancel({ requestId: cancellation.requestId });
assert.equal((await iterator.next()).value.stopReason, "cancelled");
await assert.rejects(
  cancellation.final,
  (error) =>
    error instanceof InferenceCancelledError && error.partial.text === "Hello",
);
await client.unloadModel({ modelId: "model" });
await client.close();
assert.deepEqual(
  calls.map((call) => call[0]),
  ["load", "unload", "close"],
);
assert.throws(() =>
  client.completion({ modelId: "model", history: [], tools: [] }),
);

class FakeWorker {
  listeners = new Map();
  terminated = false;
  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }
  postMessage(message) {
    assert.equal(message.type, "load");
    assert.equal(message.payload.modelSrc, "https://example.com/model.gguf");
    queueMicrotask(() =>
      this.listeners.get("message")({
        data: { id: message.id, type: "result", value: "worker-model" },
      }),
    );
  }
  terminate() {
    this.terminated = true;
  }
}
const worker = new FakeWorker();
const workerClient = createBrowserClient({ worker });
assert.equal(
  await workerClient.loadModel({ modelSrc: "https://example.com/model.gguf" }),
  "worker-model",
);
await workerClient.close();
assert.equal(worker.terminated, true);
console.log(
  "Installed browser package API passed: load, events/final, cancellation/partial, unload/close, actual runtime client Worker transport",
);
