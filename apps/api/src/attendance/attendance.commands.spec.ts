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
  getOverviewForDiscordUser: vi.fn(),
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

  it.each([
    {
      error: 'User is already signed in',
      expected: `<@${targetId}> is already signed in.`,
    },
    {
      error: 'User is already signed out',
      expected: `<@${targetId}> is already signed out.`,
    },
    {
      error: 'User was not signed out because they have not signed in yet',
      expected: `<@${targetId}> has not signed in yet.`,
    },
    {
      error: 'Not authorized to manage attendance',
      expected: 'Only active mentors and Team Admins can use this command.',
    },
  ])('formats mentor sign-in error "$error" for the target', async ({ error, expected }) => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };
    service.signInForMember.mockReturnValue(errAsync(new Error(error)));

    await commands.MentorSigninCommand([interaction] as never, { user: target } as never);

    expect(interaction.channel.send).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expected);
  });
});

describe('/attendance command', () => {
  const commands = new AttendanceCommands(service as never);

  function overview(meetingHours: number) {
    return {
      season: { id: 1, name: '2026–27' },
      hours: { meeting: meetingHours, outreach: 0, total: meetingHours },
      requirements: { meeting: 26, outreach: 5, track: 'member' },
      progress: {
        completedMeetings: 5,
        attendedMeetings: 3,
        excusedMeetings: 1,
        missedMeetings: 1,
        completedMeetingHours: 16,
        scheduledMeetingHours: 40,
        expectedHours: { member: 10.4, leadership: 15.6 },
      },
      recentActivity: [],
    };
  }

  beforeEach(() => vi.clearAllMocks());

  it.each([
    [
      'above the leadership target',
      16,
      "You're currently above the minimum hours for leadership (16.00 hours, 100.0% of 16 possible hours to date)! :tada:",
    ],
    [
      'above the member target only',
      12,
      "You're currently above the minimum hours for members (12.00 hours, 75.0% of 16 possible hours to date)! If you're on leadership, you are currently 4 hour(s) behind the leadership requirement.",
    ],
    [
      'behind the member target',
      6.5,
      "You've got 6.50 hours (40.6% of 16 possible hours to date). You are currently 4 hour(s) behind the minimum hours goal. :rocket:",
    ],
  ])('compares hours with what is expected so far when %s', async (_case, hours, message) => {
    const interaction = makeInteraction();
    service.getOverviewForDiscordUser.mockReturnValue(okAsync(overview(hours)));

    await commands.AttendanceCommand([interaction] as never);

    expect(service.getOverviewForDiscordUser).toHaveBeenCalledWith(discordId);
    expect(interaction.editReply).toHaveBeenCalledWith(
      `${message}\nMeetings so far: 3 attended, 1 excused, 1 missed (of 5).`,
    );
  });

  it('shows an infinite percentage before any meetings have finished', async () => {
    const interaction = makeInteraction();
    const empty = overview(0);
    empty.progress = {
      ...empty.progress,
      completedMeetings: 0,
      attendedMeetings: 0,
      excusedMeetings: 0,
      missedMeetings: 0,
      completedMeetingHours: 0,
      expectedHours: { member: 0, leadership: null as never },
    };
    service.getOverviewForDiscordUser.mockReturnValue(okAsync(empty));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('(0.00 hours, ∞% of 0 possible hours to date)! :tada:'),
    );
  });

  it.each([
    ['the lookup fails', errAsync(new Error('User not found'))],
    [
      'the member has no requirement this season',
      okAsync({ ...overview(0), requirements: null, progress: null }),
    ],
  ])('asks the member to tell a mentor when %s', async (_case, result) => {
    const interaction = makeInteraction();
    service.getOverviewForDiscordUser.mockReturnValue(result);

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'There was an error getting your attendance or hour requirements. Please let a mentor know.',
    );
  });
});
