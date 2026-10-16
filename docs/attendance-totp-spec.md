# Attendance display code specification

## Purpose and scope

Members at the facility read a rotating code from a password-protected Basecamp display and enter it with `/signin` or `/signout`. The code is evidence that they could see the display at that moment. It is not a member account factor or a guarantee of physical location: someone can relay a live code.

This specification covers the display, its mentor-configured password, code generation and verification, and the two self-service Discord commands. Admin attendance commands, a dedicated kiosk account, geolocation, and changes to attendance-hour calculations are out of scope.

## Member and display flow

1. A mentor configures the display password and TOTP seed in deployment configuration. A person opening the display enters that password. The server verifies it and creates a 12-hour display session.
2. The authenticated display receives the TOTP seed over HTTPS and holds it in page memory. It calculates and shows a zero-padded four-digit code locally, changing at each 30-second boundary. It also shows a countdown. Reloading the page requires a valid display session.
3. A member runs `/signin code:<four digits>` or `/signout code:<four digits>` in the configured team Discord guild. The bot responds ephemerally.
4. The API verifies the code before changing attendance. It uses the Discord actor's identity for the attendance record; the member cannot supply another user's identity through these commands. The existing attendance rules determine whether a sign-in or sign-out is valid.
5. An invalid, malformed, or expired code changes no attendance data. The member gets a short, actionable ephemeral error and can retry with the code currently on the display.

`/attendance` and `/attendance-leaderboard` do not require a display code.

## TOTP contract

| Parameter | Decision |
| --- | --- |
| Algorithm | RFC 6238 TOTP using HMAC-SHA-1 |
| Seed | At least 20 cryptographically random bytes, encoded as Base32 in configuration |
| Time origin and step | Unix time, 30-second steps |
| Output | Four decimal digits, including leading zeroes, matching the familiar FRC team-number format |
| Verification window | Current server time step and one adjacent step on either side, to tolerate small clock differences and entry near rollover |
| Comparison | Compare the supplied four-character string with each candidate code without numeric conversion, using a timing-safe comparison |

The display and API use the same seed and parameters. Both derive codes locally from their clocks; the display does not poll the API for each new code. The facility device and API host must keep their clocks synchronized. If a code is accepted in an adjacent step, the display still changes on its normal 30-second boundary.

Because the code is shared by all members viewing one screen, the verifier must allow multiple distinct members to submit the same code during a step. Attendance state must prevent duplicate sign-ins or sign-outs for a member. This is a rotating shared presence code, despite using the TOTP algorithm; global single-use replay prevention would make the shared display unusable.

## NestJS boundaries

- `AttendanceModule` owns an injectable `AttendanceCodeService` and the attendance application service. The code service reads validated configuration and verifies attendance codes; the display uses the shared code generator in its browser. Attendance writes happen only in the application service after verification.
- The Necord option DTO uses `@StringOption({ required: true })` and a validation rule requiring exactly four ASCII digits. Bind `ValidationPipe({ validateCustomDecorators: true })` to `@Options(...)`; a Discord-aware exception filter turns pipe errors into ephemeral replies. Do not use `@IntegerOption`, which loses leading zeroes.
- The service repeats the essential format and presence checks at its public boundary. A future HTTP attendance route must not bypass code verification by calling a lower-level repository directly.
- The API validates its TOTP seed, display password, and display session-signing secret at startup. Missing or invalid values fail closed rather than permitting attendance without a code. Keep the seed out of logs, errors, and database attendance rows.
- The display login and seed delivery require a valid display session. The session cookie is signed, `HttpOnly`, `Secure` in production, and expires after 12 hours without automatic renewal. The page clears its in-memory seed and stops showing codes at session expiry, requiring password entry again. Do not store the display password or TOTP seed in a persistent browser cookie or local storage. The seed is necessarily visible to the authenticated display browser while the page is open; possession of it permits generation of future codes. Responses carrying the seed must not be cached.
- Use NestJS Throttler's default in-memory storage to limit code attempts by Discord actor and display-password attempts by source address, with a clear retry response. Basecamp runs as one instance; counts reset on restart. Do not write submitted codes or passwords to logs.

The current API already records self-service sign-ins and sign-outs. TOTP verification must run before those existing service calls. The existing `attendance.user_id`, `event_id`, `checked_in_at`, and `checked_out_at` fields are sufficient for the code check itself; no TOTP value belongs in that table.

## Acceptance criteria

- Given an authenticated display, its four-digit code changes at a 30-second boundary without a network request for the next code; a leading-zero code displays all four digits.
- Given matching configuration and synchronized clocks, a code shown on the display is accepted by NestJS in the current time step. Codes in the immediately previous or next step are accepted; codes outside that window are rejected.
- Given a valid code and a valid self-service attendance transition, `/signin` or `/signout` records the Discord actor's transition exactly once and replies ephemerally.
- Given a missing, malformed, or invalid code, no attendance row is created or changed, and the interaction receives an ephemeral error.
- Given two different members who can see the display, both may use the same currently valid code. Repeating a transition for one member is still rejected by attendance rules.
- Given no valid display session, a visitor cannot obtain the seed or see the display. At 12-hour session expiry, an open display stops generating codes and asks for its password again. Invalid display-password attempts are limited.
- Given missing or invalid TOTP configuration, the application does not enable unprotected self-service attendance.

## Implementation checks

Keep tests at the public behavior boundaries. Use one fixed-clock TOTP vector to pin the four-digit algorithm and leading zeroes. Exercise acceptance, rejection, shared use, and no-write behavior through the attendance service entry points; exercise ephemeral replies through the member command methods. Check Necord option and throttle behavior in a development guild, where its actual framework pipeline runs. Exercise password, cookie, and seed protection through HTTP requests. Check the display in a browser across a rollover and after its session expires. Avoid tests that merely restate DTO decorators, private helpers, or implementation wiring.

## References

- [RFC 6238: TOTP](https://www.rfc-editor.org/rfc/rfc6238.html)
- [NestJS validation](https://docs.nestjs.com/application/validation)
- [NestJS configuration](https://docs.nestjs.com/techniques/configuration)
- [Necord validation](https://necord.org/techniques/validation)
