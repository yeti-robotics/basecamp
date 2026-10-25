import { MessageFlags } from 'discord.js';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCommands } from './attendance.commands.js';

const discordId = '123456789012345678';
const targetId = '987654321098765432';
const service = {
  signInWithCode: vi.fn(),
  signOutWithCode: vi.fn(),
  signInForMember: vi.fn(),
  signOutForMember: vi.fn(),
};

function makeInteraction() {
  const channel = {
    isSendable: vi.fn(() => true),
    send: vi.fn().mockResolvedValue(undefined),
  };

  return {
    user: { id: discordId },
    channel,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
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

  it('passes the acting and target Discord IDs to the mentor sign-in service', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };
    service.signInForMember.mockReturnValue(okAsync(undefined));

    await commands.MentorSigninCommand([interaction] as never, { user: target } as never);

    expect(service.signInForMember).toHaveBeenCalledWith(discordId, targetId);
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
    expect(interaction.channel.send).toHaveBeenCalledWith(
      `<@${targetId}> has been signed in by <@${discordId}>.`,
    );
    expect(interaction.editReply).toHaveBeenCalledWith('Successfully signed in Member.');
  });

  it('passes the acting and target Discord IDs to the mentor sign-out service', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };
    service.signOutForMember.mockReturnValue(okAsync(undefined));

    await commands.MentorSignoutCommand([interaction] as never, { user: target } as never);

    expect(service.signOutForMember).toHaveBeenCalledWith(discordId, targetId);
    expect(interaction.channel.send).toHaveBeenCalledWith(
      `<@${targetId}> has been signed out by <@${discordId}>.`,
    );
    expect(interaction.editReply).toHaveBeenCalledWith('Successfully signed out Member.');
  });

  it('does not announce a failed mentor action', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };
    service.signInForMember.mockReturnValue(
      errAsync(new Error('Not authorized to manage attendance')),
    );

    await commands.MentorSigninCommand([interaction] as never, { user: target } as never);

    expect(interaction.channel.send).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Only active mentors and Team Admins can use this command.',
    );
  });
});