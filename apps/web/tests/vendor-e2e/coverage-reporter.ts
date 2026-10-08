import type { Reporter, FullResult, Suite, TestCase } from '@playwright/test/reporter';
/** CI must reject empty, skipped, expected-failure and retry-dependent Vendor evidence. */
export default class VendorCoverageReporter implements Reporter {
  private tests: TestCase[] = [];
  onBegin(_config: unknown, suite: Suite) { this.tests = suite.allTests(); }
  async onEnd(result: FullResult) {
    const passed = this.tests.filter(t => t.expectedStatus === 'passed' && t.results.length === 1 && t.results[0].status === 'passed').length;
    const skipped = this.tests.filter(t => t.results.some(r => r.status === 'skipped')).length;
    console.log(`VENDOR_BROWSER_COVERAGE | total=${this.tests.length} | passed=${passed} | skipped=${skipped} | status=${result.status}`);
    if (!this.tests.length || passed !== this.tests.length || result.status !== 'passed') return { status: 'failed' as const };
  }
}
