export function random(minInclusive: number, maxInclusive: number) {
	return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
}

export function nRandom(minInclusive: number, maxInclusive: number, n: number) {
	const values = new Set<number>();
	while (values.size < n) {
		values.add(random(minInclusive, maxInclusive));
	}
	return [...values];
}
