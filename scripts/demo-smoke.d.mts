/** A function that replaces the origin, its host, host name and resolved addresses with `<demo>`. */
export function maskerFor(origin: URL): Promise<(text: string) => string>;
/** Whether a TLS certificate whose `valid_to` is `validTo` has at least seven whole days left at `now`. */
export function certificateCheck(validTo: string, now?: Date): { ok: boolean; days: number };
