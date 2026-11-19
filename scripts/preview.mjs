import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const files = {
  "index.html": "text/html; charset=utf-8",
  "index.css": "text/css; charset=utf-8",
  "index.js": "text/javascript; charset=utf-8",
  "engine.js": "text/javascript; charset=utf-8"
};
const prefix = "/Cps-tester/";
const port = Number(process.env.PORT || 4173);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === prefix.slice(0, -1)) {
    response.writeHead(308, { Location: prefix }).end();
    return;
  }
  const name = (pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1)) || "index.html";
  if (!Object.hasOwn(files, name)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL("../" + name, import.meta.url));
    response.writeHead(200, { "Content-Type": files[name], "Cache-Control": "no-store" }).end(content);
  } catch {
    response.writeHead(500).end();
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log("CPS Tester: http://127.0.0.1:" + server.address().port + prefix);
});
