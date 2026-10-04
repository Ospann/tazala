const mockRequireNativeModule = jest.fn((name: string) => ({ name, ping: jest.fn() }));

jest.mock('expo', () => ({
  NativeModule: Object,
  requireNativeModule: (name: string) => mockRequireNativeModule(name),
}));

describe('TazalaScannerModule', () => {
  it('binds to the TazalaScanner native module', () => {
    const scanner: unknown = jest.requireActual('../TazalaScannerModule').default;

    expect(mockRequireNativeModule).toHaveBeenCalledWith('TazalaScanner');
    expect(scanner).toMatchObject({ name: 'TazalaScanner' });
  });
});
