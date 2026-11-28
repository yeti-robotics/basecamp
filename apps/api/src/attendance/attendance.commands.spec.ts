import { MessageFlags } from 'discord.js';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCommands } from './attendance.commands.js';
import type { AttendanceLeaderboard, AttendanceOverview } from './attendance.service.js';
import {
  formatAttendanceLeaderboard,
  formatAttendanceOverview,
  formatAttendanceReadError,
} from './attendance-response.js';

const discordId = '123456789012345678';
const targetId = '987654321098765432';
const guildId = '408711970305474560';
const config = { get: vi.fn(() => guildId) };

const service = {
  signInWithCode: vi.fn(),
  signOutWithCode: vi.fn(),
  signInForMember: vi.fn(),
  signOutForMember: vi.fn(),
  getOverviewForDiscordUser: vi.fn(),
  getLeaderboardForDiscordUser: vi.fn(),
};

function makeInteraction() {
  const channel = {
    isSendable: vi.fn(() => true),
    send: vi.fn().mockResolvedValue(undefined),
  };

  return {
    user: { id: discordId },
    guildId,
    channel,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

function overview(meetingHours = 12): AttendanceOverview {
  return {
    season: { id: 1, name: '2026–27' },
    hours: {
      meeting: meetingHours,
      outreach: 0,
      total: meetingHours,
    },
    requirements: {
      meeting: 26,
      outreach: 5,
      track: 'member',
    },
    progress: {
      completedMeetings: 5,
      attendedMeetings: 3,
      excusedMeetings: 1,
      missedMeetings: 1,
      completedMeetingHours: 16,
      scheduledMeetingHours: 40,
      expectedHours: {
        member: 10.4,
        leadership: 15.6,
      },
    },
    recentActivity: [],
  };
}

const leaderboard: AttendanceLeaderboard = {
  season: { id: 1, name: '2026–27' },
  entries: [
    { rank: 1, name: 'Ada Lovelace', hours: 20 },
    { rank: 2, name: 'Grace Hopper', hours: 18.5 },
    { rank: 2, name: 'Alex Morgan', hours: 18.5 },
    { rank: 4, name: 'Sam Wilson', hours: 15 },
    { rank: 5, name: 'Taylor Smith', hours: 12 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('member attendance commands', () => {
  const commands = new AttendanceCommands(service as never, config as never);

  it('rejects attendance writes from another guild before checking a code', async () => {
    const interaction = { ...makeInteraction(), guildId: '999999999999999999' };

    await commands.SigninCommand([interaction] as never, { code: '0042' });

    expect(service.signInWithCode).not.toHaveBeenCalled();
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Use attendance commands in the configured team Discord server.',
      flags: [MessageFlags.Ephemeral],
    });
  });

  it('rejects mentor attendance writes from a direct message', async () => {
    const interaction = { ...makeInteraction(), guildId: null };

    await commands.MentorSigninCommand(
      [interaction] as never,
      {
        user: { id: targetId, username: 'Member' },
      } as never,
    );

    expect(service.signInForMember).not.toHaveBeenCalled();
    expect(interaction.channel.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Use attendance commands in the configured team Discord server.',
      flags: [MessageFlags.Ephemeral],
    });
  });

  it('signs in the Discord actor with the zero-padded display code and replies privately', async () => {
    const interaction = makeInteraction();
    service.signInWithCode.mockReturnValue(okAsync(undefined));

    await commands.SigninCommand([interaction] as never, {
      code: '0042',
    });

    expect(service.signInWithCode).toHaveBeenCalledWith(discordId, '0042');
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });
    expect(interaction.editReply).toHaveBeenCalledWith('Signed in.');
  });

  it('signs out the Discord actor with the exact display code and replies privately', async () => {
    const interaction = makeInteraction();
    service.signOutWithCode.mockReturnValue(okAsync(undefined));

    await commands.SignoutCommand([interaction] as never, {
      code: '0042',
    });

    expect(service.signOutWithCode).toHaveBeenCalledWith(discordId, '0042');
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });
    expect(interaction.editReply).toHaveBeenCalledWith('Signed out.');
  });

  it('keeps an invalid-code response private and gives the member a retry path', async () => {
    const interaction = makeInteraction();
    service.signOutWithCode.mockReturnValue(errAsync(new Error('Invalid attendance code')));

    await commands.SignoutCommand([interaction] as never, {
      code: '9999',
    });

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });
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
    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });
    expect(interaction.channel.send).toHaveBeenCalledWith({
      content: `<@${targetId}> has been signed in by <@${discordId}>.`,
      allowedMentions: { parse: [], users: [targetId, discordId] },
    });
    expect(interaction.editReply).toHaveBeenCalledWith('Successfully signed in Member.');
  });

  it('passes the acting and target Discord IDs to the mentor sign-out service', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };
    service.signOutForMember.mockReturnValue(okAsync(undefined));

    await commands.MentorSignoutCommand([interaction] as never, { user: target } as never);

    expect(service.signOutForMember).toHaveBeenCalledWith(discordId, targetId);
    expect(interaction.channel.send).toHaveBeenCalledWith({
      content: `<@${targetId}> has been signed out by <@${discordId}>.`,
      allowedMentions: { parse: [], users: [targetId, discordId] },
    });
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

  it('still confirms mentor sign-in if the announcement fails', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };

    service.signInForMember.mockReturnValue(okAsync(undefined));
    interaction.channel.send.mockRejectedValue(new Error('Missing channel permissions'));

    await commands.MentorSigninCommand([interaction] as never, { user: target } as never);

    expect(interaction.editReply).toHaveBeenCalledWith('Successfully signed in Member.');
  });

  it('confirms mentor sign-out without a sendable channel', async () => {
    const interaction = makeInteraction();
    const target = { id: targetId, username: 'Member' };

    service.signOutForMember.mockReturnValue(okAsync(undefined));
    interaction.channel.isSendable.mockReturnValue(false);

    await commands.MentorSignoutCommand([interaction] as never, { user: target } as never);

    expect(interaction.channel.send).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith('Successfully signed out Member.');
  });
});

describe('/attendance command', () => {
  const commands = new AttendanceCommands(service as never, config as never);

  it('retrieves attendance using the linked Discord identity', async () => {
    const interaction = makeInteraction();
    const data = overview();

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceCommand([interaction] as never);

    expect(service.getOverviewForDiscordUser).toHaveBeenCalledWith(discordId);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceOverview(data),
      allowedMentions: { parse: [] },
    });
  });

  it('defers privately before querying attendance', async () => {
    const interaction = makeInteraction();

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(overview()));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });

    expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(
      service.getOverviewForDiscordUser.mock.invocationCallOrder[0],
    );

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.channel.send).not.toHaveBeenCalled();
  });

  it.each([16, 12, 6.5])('formats attendance progress with %s recorded hours', async (hours) => {
    const interaction = makeInteraction();
    const data = overview(hours);

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceOverview(data),
      allowedMentions: { parse: [] },
    });
  });

  it('does not display an infinite percentage before meetings finish', async () => {
    const interaction = makeInteraction();

    const data: AttendanceOverview = {
      ...overview(0),
      progress: {
        completedMeetings: 0,
        attendedMeetings: 0,
        excusedMeetings: 0,
        missedMeetings: 0,
        completedMeetingHours: 0,
        scheduledMeetingHours: 40,
        expectedHours: { member: 0, leadership: 0 },
      },
    };

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.not.stringMatching(/∞|Infinity|NaN/),
      allowedMentions: { parse: [] },
    });
  });

  it('handles an installation without an active season', async () => {
    const interaction = makeInteraction();

    const data: AttendanceOverview = {
      season: null,
      hours: { meeting: 0, outreach: 0, total: 0 },
      requirements: null,
      progress: null,
      recentActivity: [],
    };

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceOverview(data),
      allowedMentions: { parse: [] },
    });
  });

  it('handles a member without an active season assignment', async () => {
    const interaction = makeInteraction();

    const data: AttendanceOverview = {
      ...overview(),
      requirements: null,
    };

    service.getOverviewForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceOverview(data),
      allowedMentions: { parse: [] },
    });
  });

  it.each(['User not found', 'Account is suspended', 'database unavailable'])(
    'handles attendance lookup error "%s" privately',
    async (message) => {
      const interaction = makeInteraction();
      const error = new Error(message);

      service.getOverviewForDiscordUser.mockReturnValue(errAsync(error));

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });

      expect(interaction.editReply).toHaveBeenCalledWith(formatAttendanceReadError(error));

      expect(interaction.channel.send).not.toHaveBeenCalled();
    },
  );
});

describe('/attendance-leaderboard command', () => {
  const commands = new AttendanceCommands(service as never, config as never);

  it('retrieves current-season rankings for the invoking Discord user', async () => {
    const interaction = makeInteraction();

    service.getLeaderboardForDiscordUser.mockReturnValue(okAsync(leaderboard));

    await commands.AttendanceLeaderboardCommand([interaction] as never);

    expect(service.getLeaderboardForDiscordUser).toHaveBeenCalledWith(discordId);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceLeaderboard(leaderboard),
      allowedMentions: { parse: [] },
    });
  });

  it('keeps identifiable student rankings private', async () => {
    const interaction = makeInteraction();

    service.getLeaderboardForDiscordUser.mockReturnValue(okAsync(leaderboard));

    await commands.AttendanceLeaderboardCommand([interaction] as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({
      flags: [MessageFlags.Ephemeral],
    });

    expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(
      service.getLeaderboardForDiscordUser.mock.invocationCallOrder[0],
    );

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.channel.send).not.toHaveBeenCalled();
  });

  it('disables mentions in user-controlled leaderboard names', async () => {
    const interaction = makeInteraction();

    const data: AttendanceLeaderboard = {
      season: leaderboard.season,
      entries: [{ rank: 1, name: '@everyone', hours: 10 }],
    };

    service.getLeaderboardForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceLeaderboardCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.any(String),
      allowedMentions: { parse: [] },
    });
  });

  it('handles a season without recorded meeting hours', async () => {
    const interaction = makeInteraction();

    const data: AttendanceLeaderboard = {
      season: leaderboard.season,
      entries: [],
    };

    service.getLeaderboardForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceLeaderboardCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceLeaderboard(data),
      allowedMentions: { parse: [] },
    });
  });

  it('handles an installation without an active season', async () => {
    const interaction = makeInteraction();

    const data: AttendanceLeaderboard = {
      season: null,
      entries: [],
    };

    service.getLeaderboardForDiscordUser.mockReturnValue(okAsync(data));

    await commands.AttendanceLeaderboardCommand([interaction] as never);

    expect(interaction.editReply).toHaveBeenCalledWith({
      content: formatAttendanceLeaderboard(data),
      allowedMentions: { parse: [] },
    });
  });

  it.each(['Not authorized to manage attendance', 'User not found', 'database unavailable'])(
    'handles leaderboard error "%s" without publishing rankings',
    async (message) => {
      const interaction = makeInteraction();
      const error = new Error(message);

      service.getLeaderboardForDiscordUser.mockReturnValue(errAsync(error));

      await commands.AttendanceLeaderboardCommand([interaction] as never);

      expect(interaction.deferReply).toHaveBeenCalledWith({
        flags: [MessageFlags.Ephemeral],
      });

      expect(interaction.editReply).toHaveBeenCalledWith(formatAttendanceReadError(error));

      expect(interaction.channel.send).not.toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    },
  );
});
