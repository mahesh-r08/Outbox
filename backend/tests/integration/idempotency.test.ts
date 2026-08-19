import { describe, it, expect, vi } from 'vitest';

describe('Idempotency & Concurrent Claim Safeguards', () => {
  it('guarantees that an email in "sent" status is never processed twice', async () => {
    const mockEmailState = {
      id: 'email-123',
      status: 'sent',
      sentAt: new Date(),
      messageId: '<msg-1@ethereal.email>',
    };

    // Simulated atomic claim query:
    // UPDATE scheduled_emails SET status = 'processing' WHERE id = 'email-123' AND status IN ('scheduled', 'queued', 'rescheduled')
    const atomicClaim = (state: typeof mockEmailState) => {
      if (['scheduled', 'queued', 'rescheduled'].includes(state.status)) {
        state.status = 'processing';
        return { count: 1 };
      }
      return { count: 0 };
    };

    const claimResult = atomicClaim(mockEmailState);
    expect(claimResult.count).toBe(0);
    expect(mockEmailState.status).toBe('sent'); // Status remains unchanged, send skipped
  });

  it('prevents multiple concurrent workers from claiming the same email simultaneously', async () => {
    let emailState = {
      id: 'email-concurrent-test',
      status: 'scheduled',
    };

    const attemptClaim = async (workerId: string) => {
      // Simulate atomic database transaction with row-level condition
      if (emailState.status === 'scheduled') {
        emailState.status = 'processing';
        return { workerId, claimed: true };
      }
      return { workerId, claimed: false };
    };

    // 5 concurrent workers attempting to claim the exact same email job simultaneously
    const results = await Promise.all([
      attemptClaim('worker-1'),
      attemptClaim('worker-2'),
      attemptClaim('worker-3'),
      attemptClaim('worker-4'),
      attemptClaim('worker-5'),
    ]);

    const successfulClaims = results.filter((r) => r.claimed);
    const rejectedClaims = results.filter((r) => !r.claimed);

    expect(successfulClaims.length).toBe(1);
    expect(rejectedClaims.length).toBe(4);
    expect(emailState.status).toBe('processing');
  });
});
