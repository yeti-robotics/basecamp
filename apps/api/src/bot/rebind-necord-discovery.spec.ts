import 'reflect-metadata';
import { NecordBaseDiscovery } from 'necord';
import { afterEach, describe, expect, it } from 'vitest';
import { LifecycleService } from '../lifecycle/lifecycle.service.js';
import './bot-context.module.js';

function readyDiscovery(): NecordBaseDiscovery {
  const handler = LifecycleService.prototype.onReady;
  for (const key of Reflect.getMetadataKeys(handler)) {
    const value: unknown = Reflect.getMetadata(key, handler);
    if (value instanceof NecordBaseDiscovery) return value;
  }
  throw new Error('clientReady discovery was not found');
}

describe('Necord discovery across bot restarts', () => {
  const discovery = readyDiscovery();

  afterEach(() => {
    (discovery as { contextCallback?: unknown }).contextCallback = undefined;
  });

  it('binds the new bot context after the previous one was destroyed', () => {
    discovery.setContextCallback(() => 'first');
    discovery.setContextCallback(() => 'second');

    expect(discovery.execute()).toBe('second');
  });
});
