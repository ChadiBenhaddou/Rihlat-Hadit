/// <reference lib="webworker" />
/** Layered layout off the main thread (SPEC §12: elkjs `layered`, direction DOWN, in a Web Worker). */
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (e: MessageEvent<{ id: number; graph: unknown }>) => {
  const { id, graph } = e.data;
  try {
    const result = await elk.layout(graph as Parameters<typeof elk.layout>[0]);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
