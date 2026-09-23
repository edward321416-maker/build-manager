import { readFileSync } from 'node:fs';
const report=JSON.parse(readFileSync(new URL('../../test-results/b1-results.json',import.meta.url),'utf8'));
const cases=['unauthenticated401','unassignedempty','ownorg/property','foreignorg/property404','queryauthority400','staleMembership404','suspendedUser401','oldcookieAfterLogout401','userA/BcacheIsolation','staff/residentDenied','B1demoV1Blocked','DBfailureNoFallback'];
const specs=[];
function visit(suite){specs.push(...(suite.specs??[]));for(const child of suite.suites??[])visit(child);}
for(const suite of report.suites??[])visit(suite);
if(report.errors?.length || specs.length!==cases.length || !cases.every(name=>specs.some(spec=>spec.title.includes(name))) || specs.some(spec=>spec.tests.length!==1 || spec.tests.some(test=>test.expectedStatus!=='passed' || test.status!=='expected' || test.results.length!==1 || test.results[0].status!=='passed'))){
 throw new Error('B1_E2E_REQUIRED_CASE_GATE_FAILED');
}
console.log(JSON.stringify({classification:'SYNTHETIC_AUTH_ACTUAL_WEB_POSTGRES',tests:specs.length,failed:0,skipped:0,retries:0}));
