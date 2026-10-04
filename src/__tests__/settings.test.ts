jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

const { parseSettings, defaultSettings } =
  jest.requireActual<typeof import('@/stores/settingsStore')>('@/stores/settingsStore');

describe('parseSettings', () => {
  it('returns defaults for empty storage', () => {
    expect(parseSettings({})).toEqual(defaultSettings);
  });

  it('accepts valid stored values', () => {
    expect(
      parseSettings({
        language: 'kk',
        theme: 'dark',
        similarityLevel: 'high',
        largeVideoMb: '200',
        onboardingCompleted: 'true',
      }),
    ).toEqual({
      language: 'kk',
      theme: 'dark',
      similarityLevel: 'high',
      largeVideoMb: 200,
      onboardingCompleted: true,
    });
  });

  it('falls back on unknown values', () => {
    const parsed = parseSettings({ language: 'de', theme: 'neon', largeVideoMb: '75' });
    expect(parsed.language).toBe('system');
    expect(parsed.theme).toBe('system');
    expect(parsed.largeVideoMb).toBe(defaultSettings.largeVideoMb);
  });
});
