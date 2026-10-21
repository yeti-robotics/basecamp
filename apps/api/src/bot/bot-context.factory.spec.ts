import 'reflect-metadata';
import { EventEmitter } from 'node:events';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { Client } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BotContextFactory } from './bot-context.factory.js';
import { botContextModuleForToken } from './bot-context.module.js';

vi.mock('@nestjs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nestjs/core')>();
  return { ...actual, NestFactory: { ...actual.NestFactory, createApplicationContext: vi.fn() } };
});

describe('BotContextFactory', () => {
  const login = vi.fn();
  const close = vi.fn();
  const client = Object.assign(new EventEmitter(), { login });
  const context = { get: vi.fn(() => client), close };
  let factory: BotContextFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue('token');
    close.mockResolvedValue(undefined);
    context.get.mockImplementation((token) => (token === Client ? client : undefined));
    vi.mocked(NestFactory.createApplicationContext).mockResolvedValue(context as never);
    factory = new BotContextFactory();
  });

  it('starts a Nest application context and logs the client in after initialization', async () => {
    await expect(factory.start('bot-token')).resolves.toBe(context);

    expect(NestFactory.createApplicationContext).toHaveBeenCalledWith(
      expect.objectContaining({ module: expect.any(Function) }),
      { abortOnError: false, logger: false },
    );
    expect(context.get).toHaveBeenCalledWith(Client, { strict: false });
    expect(login).toHaveBeenCalledWith('bot-token');
  });

  it('closes a partially initialized context after Discord login fails', async () => {
    const failure = new Error('invalid token');
    login.mockRejectedValueOnce(failure);

    await expect(factory.start('bot-token')).rejects.toBe(failure);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes a partially initialized context when startup is cancelled', async () => {
    let finishLogin!: (token: string) => void;
    login.mockImplementationOnce(() => new Promise((resolve) => (finishLogin = resolve)));
    const controller = new AbortController();
    const starting = factory.start('bot-token', undefined, controller.signal);
    await vi.waitFor(() => expect(login).toHaveBeenCalledOnce());

    controller.abort();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    finishLogin('bot-token');

    await expect(starting).rejects.toThrow('Discord bot startup was cancelled');
    expect(close).toHaveBeenCalledOnce();
  });

  it('contains client errors and reports them to the runtime', async () => {
    const onError = vi.fn();
    await factory.start('bot-token', undefined, undefined, onError);

    client.emit('error', new Error('command registration failed'));

    expect(onError).toHaveBeenCalledOnce();
  });

  it('passes a development guild when configured', async () => {
    const dynamicModule = botContextModuleForToken('bot-token', '123456789012345678');
    const necord = dynamicModule.imports?.find(
      (entry) =>
        typeof entry === 'object' && 'module' in entry && entry.module.name.includes('Necord'),
    );
    expect(necord).toBeDefined();
    if (!necord || typeof necord !== 'object' || !('module' in necord)) return;

    const options = necord.providers?.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'useValue' in provider &&
        typeof provider.useValue === 'object' &&
        provider.useValue !== null &&
        'token' in provider.useValue,
    );
    expect(options).toMatchObject({
      useValue: {
        token: 'bot-token',
        development: ['123456789012345678'],
      },
    });
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, necord.module)).toBeDefined();
  });

  it('supports production context without a development guild', () => {
    const dynamicModule = botContextModuleForToken('bot-token');
    const necord = dynamicModule.imports?.find(
      (entry) =>
        typeof entry === 'object' && 'module' in entry && entry.module.name.includes('Necord'),
    );
    const options =
      necord && typeof necord === 'object' && 'providers' in necord
        ? necord.providers?.find(
            (provider) =>
              typeof provider === 'object' &&
              provider !== null &&
              'useValue' in provider &&
              typeof provider.useValue === 'object' &&
              provider.useValue !== null &&
              'token' in provider.useValue,
          )
        : undefined;

    expect(options).toMatchObject({ useValue: { token: 'bot-token', development: undefined } });
  });
});
