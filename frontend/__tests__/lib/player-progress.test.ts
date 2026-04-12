import {
  computeRank,
  computeNextRank,
  getAchievement,
  personalBestKey,
  RANKS,
  ACHIEVEMENTS,
} from '@/lib/player-progress';

describe('computeRank', () => {
  it('returns cadet for 0 XP', () => {
    const rank = computeRank(0);
    expect(rank.id).toBe('cadet');
  });

  it('returns recruit at 100 XP', () => {
    const rank = computeRank(100);
    expect(rank.id).toBe('recruit');
  });

  it('returns analyst at 300 XP', () => {
    const rank = computeRank(300);
    expect(rank.id).toBe('analyst');
  });

  it('returns operator at 700 XP', () => {
    const rank = computeRank(700);
    expect(rank.id).toBe('operator');
  });

  it('returns commander at 1500 XP', () => {
    const rank = computeRank(1500);
    expect(rank.id).toBe('commander');
  });

  it('returns legend at 3000 XP', () => {
    const rank = computeRank(3000);
    expect(rank.id).toBe('legend');
  });

  it('returns legend for very high XP', () => {
    const rank = computeRank(99999);
    expect(rank.id).toBe('legend');
  });

  it('returns cadet for XP just below recruit threshold', () => {
    const rank = computeRank(99);
    expect(rank.id).toBe('cadet');
  });
});

describe('computeNextRank', () => {
  it('returns recruit as next rank for cadet', () => {
    const next = computeNextRank(0);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('recruit');
  });

  it('returns null at max rank', () => {
    const next = computeNextRank(3000);
    expect(next).toBeNull();
  });

  it('returns analyst as next for 100 XP', () => {
    const next = computeNextRank(100);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('analyst');
  });
});

describe('RANKS', () => {
  it('has 6 ranks', () => {
    expect(RANKS).toHaveLength(6);
  });

  it('ranks are in ascending XP order', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minXp).toBeGreaterThan(RANKS[i - 1].minXp);
    }
  });
});

describe('ACHIEVEMENTS', () => {
  it('has achievements defined', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThan(0);
  });

  it('each achievement has required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.category).toBeTruthy();
    }
  });
});

describe('getAchievement', () => {
  it('returns achievement by ID', () => {
    const a = getAchievement('first-mission');
    expect(a).toBeDefined();
    expect(a!.id).toBe('first-mission');
  });

  it('returns undefined for unknown ID', () => {
    expect(getAchievement('nonexistent')).toBeUndefined();
  });
});

describe('personalBestKey', () => {
  it('generates correct key', () => {
    expect(personalBestKey('scn-auth-001', 'red')).toBe('scn-auth-001:red');
    expect(personalBestKey('scn-doc-003', 'blue')).toBe('scn-doc-003:blue');
  });
});
