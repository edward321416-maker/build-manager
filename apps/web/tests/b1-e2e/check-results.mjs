import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync(new URL('../../test-results/b1-results.json', import.meta.url), 'utf8'));
const cases = [
  'R04 unauthenticated401', 'R02 unassignedempty', 'R01 ownorg/property and one-time completion',
  'R03 foreignorg/property404', 'R04 queryauthority400', 'R05 staleMembership404',
  'R05 suspendedUser401', 'R06 oldcookieAfterLogout401', 'R04 userA/BcacheIsolation',
  'R04 residentDenied', 'R09 B1demoV1Blocked', 'R10 DBfailureNoFallback',
  'AC01 adminAB', 'AC02 staffAssignedA', 'AC03 staffNoAssignmentEmpty', 'AC04 foreign404',
  'AC05 assignmentEnded', 'AC06 membershipEnded', 'AC07 orgSuspended', 'AC08 archived404',
  'AC13 forgedAuthority',
];
function collect(suite) {
  return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(collect)];
}
function verify(candidate) {
  const specs = collect(candidate);
  if (candidate.errors?.length || specs.length !== cases.length ||
      !cases.every(name => specs.filter(spec => spec.title === name).length === 1) ||
      specs.some(spec => spec.tests.length !== 1 || spec.tests.some(test =>
        test.expectedStatus !== 'passed' || test.status !== 'expected' || test.results.length !== 1 ||
        test.results[0].status !== 'passed' || test.results[0].retry !== 0 || test.results[0].errors?.length))) {
    throw new Error('B1_B2_E2E_REQUIRED_CASE_GATE_FAILED');
  }
  return specs;
}
const specs = verify(report);
// Mutate only parsed throwaway copies: the actual evidence file is never changed.
const controls = [
  copy => { const suite = copy.suites.find(s => collect(s).some(s => s.title === 'AC03 staffNoAssignmentEmpty')); function remove(s) { if (s.specs) s.specs = s.specs.filter(x => x.title !== 'AC03 staffNoAssignmentEmpty'); for (const child of s.suites ?? []) remove(child); } remove(suite); },
  copy => { const rows = collect(copy); rows[1].title = rows[0].title; },
  copy => { collect(copy)[0].tests[0].results[0].status = 'skipped'; },
  copy => { collect(copy)[0].tests[0].results[0].status = 'failed'; },
  copy => { collect(copy)[0].tests[0].results.push({ status: 'passed', retry: 1 }); },
  copy => { copy.errors = [{ message: 'synthetic report error' }]; },
];
for (const mutate of controls) {
  const copy = JSON.parse(JSON.stringify(report));
  mutate(copy);
  let rejected = false;
  try { verify(copy); } catch { rejected = true; }
  if (!rejected) throw new Error('B1_B2_E2E_GATE_NEGATIVE_CONTROL_FAILED');
}
console.log(JSON.stringify({ classification: 'SYNTHETIC_AUTH_ACTUAL_WEB_POSTGRES', tests: specs.length, failed: 0, skipped: 0, retries: 0, negativeControls: controls.length }));
