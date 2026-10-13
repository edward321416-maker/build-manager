import styles from "./core-nav.module.css";

// The MIT text shipped with @tabler/icons 3.49.0 (LICENSE), one paragraph per entry.
const TABLER_LICENSE = [
  "MIT License",
  "Copyright (c) 2020-2026 Paweł Kuna",
  "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:",
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
];

/** The notice the copied Tabler icons require (rules 8.13, REF-07). */
export function OpenSourceNotice() {
  return <section className={styles.notice} aria-label="오픈소스 라이선스">
    <p>메뉴 아이콘은 Tabler Icons 3.49.0에서 가져왔어요. 아래는 그 라이선스 원문이에요.</p>
    <h2>Tabler Icons</h2>
    <p><a className={styles.sourceLink} href="https://github.com/tabler/tabler-icons">github.com/tabler/tabler-icons</a></p>
    <div lang="en" className={styles.licenseText}>{TABLER_LICENSE.map(line => <p key={line}>{line}</p>)}</div>
  </section>;
}
