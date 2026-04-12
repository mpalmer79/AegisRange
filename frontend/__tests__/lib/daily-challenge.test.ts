import { getDailyChallenge, toLocalDateKey, addDaysToKey } from '@/lib/daily-challenge';

describe('getDailyChallenge', () => {
  it('returns a valid scenario ID', () => {
    const challenge = getDailyChallenge(new Date('2025-01-15'));
    expect(challenge.scenarioId).toBeTruthy();
    expect(challenge.scenarioId.startsWith('scn-')).toBe(true);
  });

  it('returns the same challenge for the same date', () => {
    const date = new Date('2025-06-01T12:00:00Z');
    const a = getDailyChallenge(date);
    const b = getDailyChallenge(date);
    expect(a.scenarioId).toBe(b.scenarioId);
    expect(a.perspective).toBe(b.perspective);
    expect(a.difficulty).toBe(b.difficulty);
  });

  it('returns a different challenge for a different date', () => {
    const day1 = getDailyChallenge(new Date('2025-01-01'));
    const day2 = getDailyChallenge(new Date('2025-01-02'));
    // At minimum one property should differ (scenario, perspective, or difficulty)
    const sameAll =
      day1.scenarioId === day2.scenarioId &&
      day1.perspective === day2.perspective &&
      day1.difficulty === day2.difficulty;
    expect(sameAll).toBe(false);
  });

  it('has bonusMultiplier of 1.5', () => {
    const challenge = getDailyChallenge(new Date('2025-03-10'));
    expect(challenge.bonusMultiplier).toBe(1.5);
  });

  it('has a dateKey field', () => {
    const challenge = getDailyChallenge(new Date('2025-03-10'));
    expect(challenge.dateKey).toBeTruthy();
  });

  it('includes a scenarioName', () => {
    const challenge = getDailyChallenge(new Date('2025-03-10'));
    expect(challenge.scenarioName).toBeTruthy();
    expect(challenge.scenarioName.length).toBeGreaterThan(0);
  });
});

describe('toLocalDateKey', () => {
  it('returns YYYY-MM-DD format', () => {
    const key = toLocalDateKey(new Date('2025-06-15T00:00:00'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDaysToKey', () => {
  it('adds days correctly', () => {
    const result = addDaysToKey('2025-01-01', 1);
    expect(result).toBe('2025-01-02');
  });

  it('handles month boundaries', () => {
    const result = addDaysToKey('2025-01-31', 1);
    expect(result).toBe('2025-02-01');
  });

  it('handles negative delta', () => {
    const result = addDaysToKey('2025-01-05', -3);
    expect(result).toBe('2025-01-02');
  });
});
