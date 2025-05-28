export namespace HelperUtils {
    /**
     * Create a random uuid as number
     * @param max maximum of the uuid, undefined will set the maximum to
     * @returns random number
     */
    export const RandomNumber = (max?: number): number => {
        if (!max || max <= 0 || max > Number.MAX_SAFE_INTEGER || !Number.isInteger(max)) {
            max = Number.MAX_SAFE_INTEGER;
        }

        const bitLength = Math.ceil(Math.log2(max));
        const byteLength = Math.ceil(bitLength / 8);
        const bytes = new Uint8Array(byteLength);

        let result;
        do {
            crypto.getRandomValues(bytes);
            result = bytesToInteger(bytes) & ((1 << bitLength) - 1);
        } while (result >= max);

        return result;
    };

    export const RandomNegativNumber = (): number => {
        return RandomNumber(Number.MIN_SAFE_INTEGER) * -1;
    };

    function bytesToInteger(bytes: Uint8Array): number {
        return bytes.reduce((acc, byte, i) => acc + (byte << (8 * (bytes.length - i - 1))), 0);
    }
}
