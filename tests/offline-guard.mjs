import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";

// Fail the process even if an application catches an upstream request error.
function denyNetwork() {
  process.stderr.write("Offline test attempted network access. Use an explicit live test command.\n");
  process.exit(1);
}

globalThis.fetch = denyNetwork;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // tsx uses a local IPC pipe. Only path-based IPC is allowed, never TCP.
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const socketPath = typeof options === "object" ? options?.path : options;
  if (typeof socketPath === "string" &&
    (socketPath.startsWith("/") || socketPath.startsWith("\\\\.\\pipe\\") || socketPath.startsWith("\\\\?\\pipe\\"))) {
    return Reflect.apply(connect, this, args);
  }
  return denyNetwork();
};
tls.connect = denyNetwork;
syncBuiltinESMExports();
