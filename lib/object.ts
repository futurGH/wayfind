type PartialIf<T, Cond extends boolean> = Cond extends true ? Partial<T> : T;

export function pick<T, K extends keyof T>(
	obj: T,
	...keys: Array<K>
): PartialIf<Pick<T, K>, Record<string, string> extends T ? true : false> {
	const result = {} as any;
	for (const key of keys) {
		if (obj[key]) result[key] = obj[key];
	}
	return result;
}

export function pickRemap<
	T,
	K extends keyof T,
	const Mappings extends ReadonlyArray<readonly [K, PropertyKey]>,
>(
	obj: T,
	...mappings: Mappings
): PartialIf<
	{
		-readonly [
			I in keyof Mappings as Mappings[I] extends readonly [any, infer M extends PropertyKey]
				? M
				: never
		]: Mappings[I] extends readonly [infer Key extends keyof T, any] ? T[Key] : never;
	},
	Record<string, string> extends T ? true : false
> {
	const result = {} as any;
	for (const mapping of mappings) {
		if (obj[mapping[0]]) result[mapping[1]] = obj[mapping[0]];
	}
	return result;
}
