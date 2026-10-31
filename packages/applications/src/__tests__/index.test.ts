describe('Basic Template Test', () => {
    it('Returns OK', () => {
        const fn = () => 'ok';

        expect(undefined).toBeUndefined();
        expect(null).toBeNull();
        expect(123).toBe(123);
        expect(fn()).toBe('ok');
    });
});
