import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";

// Transport tests talk to a local server. Only literal loopback addresses are allowed, never DNS names.
const loopbackHosts = new Set(["127.0.0.1", "::1"]);

// Fail the process even if an application catches an upstream request error.
function denyNetwork() {
  process.stderr.write("Offline test attempted network access. Use an explicit live test command.\n");
  process.exit(1);
}

const fetchUpstream = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol === "http:" && loopbackHosts.has(url.hostname.replace(/^\[|\]$/g, ""))) {
    return fetchUpstream(input, init);
  }
  return denyNetwork();
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // tsx uses a local IPC pipe. Path-based IPC and loopback TCP are allowed, nothing else.
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const socketPath = typeof options === "object" ? options?.path : options;
  if (typeof socketPath === "string" &&
    (socketPath.startsWith("/") || socketPath.startsWith("\\\\.\\pipe\\") || socketPath.startsWith("\\\\?\\pipe\\"))) {
    return Reflect.apply(connect, this, args);
  }
  const host = typeof options === "object" ? options?.host : args[1];
  if (typeof host === "string" && loopbackHosts.has(host)) {
    return Reflect.apply(connect, this, args);
  }
  return denyNetwork();
};
tls.connect = denyNetwork;
syncBuiltinESMExports();
