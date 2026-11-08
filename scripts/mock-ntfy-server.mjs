#!/usr/bin/env node
// Local mock of the ntfy HTTP publish API, for end-to-end development only.
// It publishes nothing to the internet; it prints every request.
//
// Usage:  node scripts/mock-ntfy-server.mjs   (listens on 127.0.0.1:3001)
// Pair it with .env.local:
//   NTFY_TOPIC=local-dev-test-topic
//   NTFY_SERVER_URL=http://127.0.0.1:3001

import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3001);

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    console.log(`[mock-ntfy] ${req.method} ${req.url}`);
    console.log(`[mock-ntfy]   Title:        ${req.headers.title ?? "(none)"}`);
    console.log(`[mock-ntfy]   Priority:     ${req.headers.priority ?? "(none)"}`);
    console.log(
      `[mock-ntfy]   Authorization: ${req.headers.authorization ? "(present)" : "(absent)"}`,
    );
    console.log(`[mock-ntfy]   Message:      ${JSON.stringify(body)}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: `mock-${Date.now().toString(16)}`,
        time: Math.floor(Date.now() / 1000),
        event: "message",
        topic: req.url.slice(1),
        mock: true,
      }),
    );
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`mock ntfy listening on http://127.0.0.1:${port}`);
});
