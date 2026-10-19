import { MessageFlags } from 'discord.js';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCommands } from './attendance.commands.js';

const discordId = '123456789012345678';
const service = {
  signInWithCode: vi.fn(),
  signOutWithCode: vi.fn(),
};

function makeInteraction() {
  return {
    user: { id: discordId },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('member attendance commands', () => {
  const commands = new AttendanceCommands(service as never);

  beforeEach(() => vi.clearAllMocks());

  it('signs in the Discord actor with the zero-padded display code and replies privately', async () => {
    const interaction = makeInteraction();
    service.signInWithCode.mockReturnValue(okAsync(undefined));

    await commands.SigninCommand([interaction] as never, { code: '0042' });

    expect(service.signInWithCode).toHaveBeenCalledWith(discordId, '0042');
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
    expect(interaction.editReply).toHaveBeenCalledWith('Signed in.');
  });

  it('signs out the Discord actor with the exact display code and replies privately', async () => {
    const interaction = makeInteraction();
    service.signOutWithCode.mockReturnValue(okAsync(undefined));

    await commands.SignoutCommand([interaction] as never, { code: '0042' });

    expect(service.signOutWithCode).toHaveBeenCalledWith(discordId, '0042');
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
    expect(interaction.editReply).toHaveBeenCalledWith('Signed out.');
  });

  it('keeps an invalid-code response private and gives the member a retry path', async () => {
    const interaction = makeInteraction();
    service.signOutWithCode.mockReturnValue(errAsync(new Error('Invalid attendance code')));

    await commands.SignoutCommand([interaction] as never, { code: '9999' });

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Invalid or expired code. Check the display and try again.',
    );
  });
});
