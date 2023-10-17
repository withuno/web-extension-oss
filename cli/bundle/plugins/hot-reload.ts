import http, { ServerResponse } from "http";
import type { Socket } from "net";

import { Plugin } from "esbuild";
import { addShutdownTask } from "flik";

import { BundleContext } from "../types";

/**
 * Enables hot reloading for development.
 */
export function hotReload(ctx: BundleContext): Plugin {
  const pluginName = "web-ext.cli.build:hot-reload";

  return {
    name: pluginName,
    setup: (build) => {
      if (!ctx.watch) {
        return;
      }

      createHotReloadServer();

      build.onEnd(() => {
        triggerReload();
      });
    },
  };
}

export function triggerReload() {
  emitServerSentEvent("reload");
}

const clients: ServerResponse[] = [];

function emitServerSentEvent<T>(event: string, data?: T) {
  if (clients.length) {
    for (const client of clients) {
      client.write(`id: ${Date.now()}\n`);
      client.write(`event: ${event}\n`);
      client.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
    }
  }
}

function createHotReloadServer() {
  // Create a server to handle incoming server-sent event (SSE) connections.
  // We use SSEs to inform the client-side when to hot-reload...
  const server = http.createServer((req, res) => {
    if (req.headers.accept && req.headers.accept === "text/event-stream") {
      if (req.url === "/reload") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        clients.push(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    }
  });

  // Save incoming connections so we can properly close them out if the dev
  // server is stopped.
  const connections: Record<string, Socket> = {};
  server.on("connection", (conn) => {
    const key = `${conn.remoteAddress}:${conn.remotePort}`;
    connections[key] = conn;
    conn.on("close", () => {
      delete connections[key];
    });
  });

  // Send a keep-alive message every 15s.
  const keepAliveInterval = setInterval(() => {
    emitServerSentEvent("keep-alive");
  }, 15000);

  // Upon shutdown, cleanup the hot-reload server and kill outstanding
  // connections.
  addShutdownTask(async () => {
    return new Promise<void>((resolve) => {
      clearInterval(keepAliveInterval);

      server.close(() => {
        resolve();
      });

      for (const key in connections) {
        connections[key].destroy();
      }
    });
  });

  server.listen(1234);
}
