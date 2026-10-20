import { MessageFlags } from 'discord.js';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCommands } from './attendance.commands.js';

const discordId = '123456789012345678';
const service = {
  signInWithCode: vi.fn(),
  signOutWithCode: vi.fn(),
  summaryForDiscord: vi.fn(),
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

  describe('/attendance', () => {
    const summary = {
      season: { id: 7, name: '2026–27' },
      meetingHours: 12.5,
      meetingRequirement: 40,
      signedIn: true,
    };

    it('defers privately before looking up the requesting member and shows their summary', async () => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockImplementation(() => {
        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
        return okAsync(summary);
      });

      await commands.AttendanceCommand([interaction] as never);

      expect(service.summaryForDiscord).toHaveBeenCalledWith(discordId);
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: [
          'Season: 2026–27',
          'Meeting hours: 12.5 hrs',
          'Meeting requirement: 40 hrs',
          'Status: Signed in',
          'Hours only include completed sessions.',
        ].join('\n'),
        allowedMentions: { parse: [] },
      });
    });

    it('shows zero hours and signed-out status for a member without attendance', async () => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockReturnValue(
        okAsync({ ...summary, meetingHours: 0, signedIn: false }),
      );
      await commands.AttendanceCommand([interaction] as never);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Meeting hours: 0.0 hrs'),
        }),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Status: Signed out'),
        }),
      );
    });

    it('explains a missing requirement instead of presenting it as zero', async () => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockReturnValue(okAsync({ ...summary, meetingRequirement: null }));
      await commands.AttendanceCommand([interaction] as never);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Meeting requirement: not configured'),
        }),
      );
    });

    it('preserves an explicitly configured zero-hour requirement', async () => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockReturnValue(okAsync({ ...summary, meetingRequirement: 0 }));
      await commands.AttendanceCommand([interaction] as never);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Meeting requirement: 0 hrs'),
        }),
      );
    });

    it('explains a missing active season and still shows sign-in status', async () => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockReturnValue(okAsync({ ...summary, season: null }));
      await commands.AttendanceCommand([interaction] as never);
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'No active season is configured yet.\nStatus: Signed in',
        allowedMentions: { parse: [] },
      });
    });

    it.each([
      [
        'User not found',
        'Sign in to the Basecamp dashboard with Discord first, then try /attendance again.',
      ],
      [
        'database connection details',
        'Attendance could not be loaded. Please try again or ask a mentor.',
      ],
    ])('handles %s with a private, actionable response', async (error, message) => {
      const interaction = makeInteraction();
      service.summaryForDiscord.mockReturnValue(errAsync(new Error(error)));
      await commands.AttendanceCommand([interaction] as never);
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: [MessageFlags.Ephemeral] });
      expect(interaction.editReply).toHaveBeenCalledWith(message);
    });
  });

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
