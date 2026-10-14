/** A function that replaces the origin, its host, host name and resolved addresses with `<demo>`. */
export function maskerFor(origin: URL): Promise<(text: string) => string>;
/** Whether a TLS certificate whose `valid_to` is `validTo` has at least seven whole days left at `now`. */
export function certificateCheck(validTo: string, now?: Date): { ok: boolean; days: number };
/** The synthetic request text `--write-check` saves; it must not match the domain's safety text scan. */
export const WRITE_CHECK_TEXT: string;
/** The 처리 시작 and 처리 완료 messages `--write-check` records when it closes its own request; same safety rule. */
export const WRITE_CHECK_CLOSE_MESSAGES: Readonly<{ start: string; complete: string }>;
/** Runs in the demo page as the signed-in manager: 처리 시작, then 처리 완료 only if that was accepted. Status codes only. */
export function closeAsManager(
  input: { ticketId: string; start: string; complete: string },
  fetchImpl?: typeof fetch,
): Promise<{ access: number; started: number | null; completed: number | null }>;
/** Runs in the demo page as the signed-in tenant: confirms the result as resolved, then reads the work status back. */
export function confirmAsTenant(
  input: { ticketId: string; clientRequestId: string },
  fetchImpl?: typeof fetch,
): Promise<{ access: number; resolved: number | null; workStatus: string | null }>;
