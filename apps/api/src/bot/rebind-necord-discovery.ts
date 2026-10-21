import { NecordBaseDiscovery } from 'necord';

type DiscoveryCallback = (...args: unknown[]) => unknown;

// Necord keeps one discovery object on each handler for the life of the process
// and ignores every callback after the first. A restarted bot would keep calling
// the destroyed context, including its ended database pool.
const discovery = NecordBaseDiscovery.prototype as NecordBaseDiscovery & {
  contextCallback?: DiscoveryCallback;
};
const keepFirstCallback = discovery.setContextCallback;

discovery.setContextCallback = function (this: { contextCallback?: DiscoveryCallback }, callback) {
  this.contextCallback = undefined;
  keepFirstCallback.call(this, callback);
};
