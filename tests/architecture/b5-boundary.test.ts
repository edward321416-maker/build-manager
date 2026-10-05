import { readFile,readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { expect,it } from "vitest";
import { moduleEdges,scanB1ProductionGraph } from "./b1-graph";
const frozen: Record<string,string> = {
  ".github/workflows/app-check.yml": "ab681452c8acb317fc2d00bd43d07b23b3f4c048c9799341be70812e701dd6f3",
  ".github/workflows/repository-check.yml": "392407bd74e65887dfb68ebea5a0fa0d3cba1bbdd631905a4d28dc1f91f8bf8c",
  "apps/mobile/package.json": "1946dbc04a065a94ccbb2498f0059cc538dd29a327a376fe3045bdf51ca24ce7",
  "apps/web/package.json": "b9281baa310f2772de79d47fe9f31bb74dbdf25798259db9732940830162c7b0",
  "apps/web/tests/b1-e2e/global-setup.ts": "05c7fbcca8b2cbe5d0ea67d557ecd85ce1707311ddd03ef16caf5d4e14a377ad",
  "apps/web/tests/b1-e2e/package.json": "609158e6c5fbc237939fa3ddf7faab80ab690bdc0c8d584414a885130103c4e8",
  "package-lock.json": "772e2956bfd8689bb382a2d8c4a9103f8a126d72dcb05449f9863d176d2d450f",
  "package.json": "5a5a3a6cc5f9b3c07eeff23e47543d4752c7f2dd7b32e6492f7b1c5bf8a275e6",
  "packages/api-client/package.json": "b772b240f83f7a4e0c3d69fefdbd0304fc65b3bb725477d684bb45815020a8d7",
  "packages/api-contracts/package.json": "41c581d5c36031b053dcd560249f57615e00238cf52fa1d75b699ee538803909",
  "packages/application/package.json": "b33dfa76f99cab1b7918c76870a86c570efcd8b3fec4f4751c949a416865b666",
  "packages/application/src/b1/begin-web-session.test.ts": "aea33b8dd1c32ed850dc3787ea38122292b68d083783f1df239e91a5e1c7e49a",
  "packages/application/src/b1/begin-web-session.ts": "472c024acb85ef14c4a0b3d1ebcdf80570bfddec716a944e119982758f1a9ab7",
  "packages/application/src/b1/errors.ts": "46d57fcbdba62e7d5e3f970679d1d75f516f983c409d3f0410001f6b55c9dc78",
  "packages/application/src/b1/organization-access.test.ts": "e3851985eadbf024607d99081a483ddc3ed49b9b53211c0e0d74e926d506888b",
  "packages/application/src/b1/organization-access.ts": "816d304b33931340651fed3e37a97a1d029f7ecc1b53c088896db686f143ef34",
  "packages/application/src/b1/ports.ts": "c38afd51df63f20be6ac38331404cf256e5e88f15d6accdf4608ef1140b7ec1c",
  "packages/application/src/b3/building-registration.test.ts": "154bcc57f3542207ed9ba7b54b19556008823b261cea66d859df106d40666b51",
  "packages/application/src/b3/building-registration.ts": "1f908a1f22d330782aa4171a376773099783526bb558b5982e81db6599cab4af",
  "packages/application/src/b3/errors.ts": "71b61ebe381b9922798e1efd181d8780963c699d89fa886cc29115c0aa9440ca",
  "packages/application/src/b3/ports.ts": "ddab0a49936c4ee1fe708d8a404b679a87a016c54b7df2ee6e2f6db78d818482",
  "packages/application/src/b3/validation.ts": "149350a3433536c738a97caa4ec39b0d6af5a192153420c9d78368f403bd35fa",
  "packages/application/src/b4/errors.ts": "f1fa1ac75325d9e61366d4946a8d4a460bfffed6a22cb5e294a1a202c3ee9ab2",
  "packages/application/src/b4/ports.ts": "3265269f1151eec9260866eb16a84f2cca6c6fe789629b8ec5e2c88683bcbaa2",
  "packages/application/src/b4/property-assignment.test.ts": "c7c53ed8b01db8161f3c630db968aec51c81a74c0911cc8c08f07d5d1d5eb115",
  "packages/application/src/b4/property-assignment.ts": "d8db1398e39f557cc483018ae8415aa277bc35023bbe8b0754eddc2cda00ef0d",
  "packages/application/src/b4/validation.ts": "79b13c056c0bce1d753c0ee644ec7865a393a74c157b18d122ba9a741706610e",
  "packages/domain/package.json": "3b359724db73605f995822daf587e4275451611118c714341a7725a3f96fa2e8",
  "packages/fixtures/package.json": "72dd44b9619b255fcf46c27315bbbd32a2a7d0c5c56ca90841390dfd3ad07065",
  "packages/persistence-postgres/migrations/0001_core_identity_organization.sql": "e10a8d4acd3d11fb3bf90b05d3f123081f6ee4a29d325b0b669a56f819b261f1",
  "packages/persistence-postgres/migrations/0002_property_unit_occupancy.sql": "1733fbaf57a93e8d8eafc98207700f198a3b67ddfd022058b2aa09c3630aa77a",
  "packages/persistence-postgres/migrations/0003_runtime_isolation.sql": "649a0519aa94e2bde319d4eac936dc9c8955739d92ff934211fa2f9d54213cf6",
  "packages/persistence-postgres/migrations/0004_b1_identity_sessions.sql": "2ab71a55851cc37e34e62a5ce7b81c03983b95c67e2e15127e7e31edbe79220a",
  "packages/persistence-postgres/migrations/0005_b1_auth_capabilities.sql": "22aea03a276673ca9e0e6929cc0193b83463b890845b5551d485100ce572ed33",
  "packages/persistence-postgres/migrations/0006_b1_organization_access.sql": "a3dc5101aa69cb3fa65499573fd331273cd311c1349b1a62d38d267b4931a8fe",
  "packages/persistence-postgres/migrations/0007_b2_property_assignment_scope.sql": "4b6e9e27dbc87142ad8d9d5f0dce37a57b97b2374ba41c2b9f7d4433183b2ac2",
  "packages/persistence-postgres/migrations/0008_b3_building_registration.sql": "c91f02d91f05090e4cd4b03f8a9dd83f6770163830b0a9618bef5d6fc16a2986",
  "packages/persistence-postgres/migrations/0009_b4_property_assignment_mutation.sql": "021ce7b36282e3a8a1ae12a4daecb944a9400a04825c2f65646944756b537fd4",
  "packages/persistence-postgres/src/b1/identity-session.ts": "9d4c0299aad456131640a038b0a968fa8271e28503327e0eb705530458bcec16",
  "packages/persistence-postgres/src/b1/index.ts": "f19498ec6a1a16d47ce1d6cb0d86ff24a98b882040e6aa100e74866563c9cde0",
  "packages/persistence-postgres/src/b1/org-transaction.ts": "e52ec6ea86aa314526481ca8ffff507129b7d9f6b57bbe6dc9decc8c38670c21",
  "packages/persistence-postgres/src/b1/organization-reader.ts": "22d1eedc03d6ed4eb2122d4c6f8453c68b16289641a8c7d905041cdc42fa58a4",
  "packages/persistence-postgres/src/b3/common.ts": "86a27505464292e5dd655d86450760ade91ca04999fc3de7800be86663b6db5b",
  "packages/persistence-postgres/src/b3/index.ts": "bde82b8dd9204f51fc11012602b3d68baef7d2fa092c9321d0256e9eb192edde",
  "packages/persistence-postgres/src/b3/registration.ts": "0d77fcbf0d1507701112b48bafda9adc3f0d87589f03bf0e82c04137932c0266",
  "packages/persistence-postgres/src/b3/unit-reader.ts": "0d1fc9cf91874170b4b1e9007f60a2edc35604f050d7128ed80ac3068e1774a3",
  "packages/persistence-postgres/src/b4/index.ts": "636a98026058a60bb73a90cf66f397053be284004f428710fe8924f4fdfc437c",
  "packages/persistence-postgres/src/b4/property-assignment.ts": "745918c0b9d05e8d6b2d5f145ea433c5308d98d02bbb0cbfa43430761eecf5a9",
  "packages/persistence-postgres/src/database.ts": "9d91a433248712d6c1b5f9715990c73814f1b71b0161c718a0049af16f79971f",
  "packages/persistence-postgres/src/testing/migrate.ts": "7d857ffa6cb2f846430d9a6976e341d6ae568f764ca3b125bcf14e6d8b1dd925",
  "packages/persistence-postgres/src/transaction.ts": "cccd4e77294fd92e2f61857d3d7a80543eff413525018c11561346881e442a60",
  "tests/postgres/foundation.test.ts": "09b40e3d8c383f11eec9a769e6a26533701a2f7a798f66013e1089d023eefd90",
  "tests/postgres/helpers/idle-pool-worker.ts": "44b7ce7430fdc08f7a730c6407f16000d3d803170c36fc9c2e5b165bdf81a169"
};
it("AC17 frozen foundation, dependency and workflow inventory retains canonical bytes",async()=>{
  for(const [path,expected] of Object.entries(frozen)) {
    let canonical=(await readFile(path,"utf8")).replaceAll("\r\n","\n");
    // Issue72 authorization5996150407 permits only this exact successor block.
    if(path===".github/workflows/app-check.yml"){
      const successorBlock=String.raw`      - name: Prepare Core synthetic state
        shell: bash
        run: |
          node --experimental-transform-types scripts/core-flow-dev.mjs --prepare
      - name: Run complete Core release gate
        working-directory: apps/web
        shell: bash
        run: |
          npm exec -- playwright test --config playwright.core.config.ts --workers=1 --retries=0
      - name: Prepare SDK synthetic state
        shell: bash
        run: |
          node --experimental-transform-types scripts/core-flow-b1-dev.mjs --prepare-synthetic-sdk
      - name: Run complete SDK Core release gate
        working-directory: apps/web
        shell: bash
        run: |
          npm exec -- playwright test --config playwright.core-login.config.ts --workers=1 --retries=0
`;
      expect(canonical.split(successorBlock)).toHaveLength(2);
      const jobStart=canonical.indexOf("  web-e2e:\n");
      const jobEnd=canonical.indexOf("  mobile-health:\n",jobStart);
      expect(jobStart).toBeGreaterThanOrEqual(0);
      expect(jobEnd).toBeGreaterThan(jobStart);
      const steps=[
        "      - name: Build Web once for both browser suites\n",
        "      - name: Prepare Core synthetic state\n",
        "      - name: Run complete Core release gate\n",
        "      - name: Prepare SDK synthetic state\n",
        "      - name: Run complete SDK Core release gate\n",
        "      - name: Run Web E2E with existing synthetic-state configuration\n",
        "      - name: Run B1 Web with PostgreSQL and synthetic SDK sessions\n",
      ];
      let previous=jobStart;
      for(const step of steps){
        expect(canonical.split(step),step).toHaveLength(2);
        const position=canonical.indexOf(step);
        expect(position,step).toBeGreaterThan(previous);
        expect(position,step).toBeLessThan(jobEnd);
        previous=position;
      }
      canonical=canonical.replace(successorBlock,"");
    }
    // The operator's RC1 photo directive explicitly permits only this existing
    // codec as a pinned direct dependency. Reverse that exact additive delta,
    // then retain every original B5 hash and all other dependency bytes.
    if(path==="apps/web/package.json"){
      const manifest=JSON.parse(canonical);
      expect(manifest.dependencies.next).toBe("16.3.8");
      expect(manifest.devDependencies["eslint-config-next"]).toBe("16.3.8");
      manifest.dependencies.next="16.3.4";
      manifest.devDependencies["eslint-config-next"]="16.3.4";
      expect(manifest.dependencies.sharp).toBe("0.35.4");delete manifest.dependencies.sharp;
      canonical=JSON.stringify(manifest,null,2)+"\n";
    }
    if(path==="package-lock.json"){
      const lock=JSON.parse(canonical);
      // Complete field-level delta from base954ef347, derived before this edit.
      // Assert every successor value before reversing only those exact fields.
      const ABSENT=Symbol("ABSENT");
      const successorDelta=[
        [["packages","apps/web","dependencies","next"],"16.3.4","16.3.8"],
        [["packages","apps/web","devDependencies","eslint-config-next"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/env","integrity"],ABSENT,"sha512-Al9zqHVV7TJv0eFuOU4U7Lvv74PTih4Ch63sk2xCIpSTkE3udFnaOcnzP2lQVymiL7yS9Cj2iClUXlR3EQ5sEw=="],
        [["packages","node_modules/@next/env","resolved"],ABSENT,"https://registry.npmjs.org/@next/env/-/env-16.3.8.tgz"],
        [["packages","node_modules/@next/env","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/eslint-plugin-next","integrity"],ABSENT,"sha512-eCR9RcLTZrVS+K3+VOhi0xMdUUGNuriCHHhU1ZoABC/QQ/Gp0OWbLKQxV2/9DkmihYdYRcQWFmZXW8M1AMUXYw=="],
        [["packages","node_modules/@next/eslint-plugin-next","resolved"],ABSENT,"https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-16.3.8.tgz"],
        [["packages","node_modules/@next/eslint-plugin-next","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/eslint-plugin-next/node_modules/@eslint-community/eslint-utils","integrity"],ABSENT,"sha512-phrYmNiYppR7znFEdqgfWHXR6NCkZEK7hwWDHZUjit/2/U0r6XvkDl0SYnoM51Hq7FhCGdLDT6zxCCOY1hexsQ=="],
        [["packages","node_modules/@next/eslint-plugin-next/node_modules/@eslint-community/eslint-utils","resolved"],ABSENT,"https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.9.1.tgz"],
        [["packages","node_modules/@next/eslint-plugin-next/node_modules/eslint-visitor-keys","integrity"],ABSENT,"sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag=="],
        [["packages","node_modules/@next/eslint-plugin-next/node_modules/eslint-visitor-keys","resolved"],ABSENT,"https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz"],
        [["packages","node_modules/@next/swc-darwin-arm64","integrity"],"sha512-iBr3I5LZNk5/bgl5//iTgD2tcym14MX0Xo7fD//u9dYAEgGzza1y9oywluPtf74YnOswVdH1908aK9xVz7zQTw==","sha512-2JPRMh2nmQG5CiL7cXGL9AGwnPWJQ//cTtAUCT+w511QHk79SYz3LGv/pc5X643B/WEO0rvu3Yww0hqwt3kgeA=="],
        [["packages","node_modules/@next/swc-darwin-arm64","resolved"],"https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.4.tgz","https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-darwin-arm64","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-darwin-x64","integrity"],"sha512-2dpiSyl2Jw/NrBPaU2MAKGSa+2MR82pJIn4Sm5Rjr+gxAeuh0z158Su3Z2O8zn7UNNq+ej4bToed6RcRN/Lydg==","sha512-GZtCCOBKJ4leVIT/Th0llWKhD1ca92lzbQiS5R5ON9QkoiFnilFsebDae1JU2a3HWoKMEmEZWGs1AGLavVM72Q=="],
        [["packages","node_modules/@next/swc-darwin-x64","resolved"],"https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.4.tgz","https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-darwin-x64","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-linux-arm64-gnu","integrity"],"sha512-+t+U8HZT+fApePCS5h89CSH3datz29MkzyfCn+6fpsZBG/oiEOhINcb9rtkv6sdpToLGFn2e6146NzaKCXkqrA==","sha512-O659ygeQYqneJ1fBKMpFxIFqYkYswu8IAS1OCKK/4f3ZgJJm1dRz4fVJZRi/kLLWjnBKnebOePA4WNv+sV1pVA=="],
        [["packages","node_modules/@next/swc-linux-arm64-gnu","resolved"],"https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.4.tgz","https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-linux-arm64-gnu","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-linux-arm64-musl","integrity"],"sha512-mx03GNs1ocQA5JQ4FxDMmIsNkdrZh8cuezKCrId28e5/gIPU/l7Kcy2+vmCCzdjnnmXJy+iOAu+7K0QppO6Urg==","sha512-dSjKSyWpzxoO1d3DIZZcP4XJcNaKeLmxQMFOiYl5vuBRMmweIqnAhty8tAmRsvTss779cK1FtYnDMj40e4TQlg=="],
        [["packages","node_modules/@next/swc-linux-arm64-musl","resolved"],"https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.4.tgz","https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-linux-arm64-musl","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-linux-x64-gnu","integrity"],"sha512-YIhGY6fSMfha52bnVxnzc9zaVBzJg+cqQTOD8tXIBSx4fuv0pVMxQTE0PaS59YhnMOiYiG09IMwxJAf/CFm/Dw==","sha512-lbqOuz3RPRcv+o9msNsJw5x4+Y1ZwPTs6vmL6DCf7i0fZfvng/F59wyeDwqHIvV0mK//RBy/jJkZ+nCKsSMXjQ=="],
        [["packages","node_modules/@next/swc-linux-x64-gnu","resolved"],"https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.3.4.tgz","https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-linux-x64-gnu","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-linux-x64-musl","integrity"],"sha512-+eaaX6axpDb0yF1GCpiERe6njplvdC+nks/fKfcHu3XPGRrald8P3/X7yv7QLdjA51knnxwl9pxdIJsg+w1L+Q==","sha512-+316WswI8ScVgZeUd+1KGaXkHhaYQzCjvH/05TZSpJ8zBizb1a4G7DtO7F12jcBIqMOtsz9ji1t48fmKtzqsGA=="],
        [["packages","node_modules/@next/swc-linux-x64-musl","resolved"],"https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.3.4.tgz","https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-linux-x64-musl","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-win32-arm64-msvc","integrity"],"sha512-0jcXW7Xs/uzICrmgV3MhDYDeRy++1CqnpDIerlPIqYO4bhzB4WNbX/aRnQclustsAyTkFKB0z6rbcjmNg5tR8A==","sha512-ji0gd4kMYUxO+1fJBIbiBVRCjzG/lloiyCccnlebvb1ZJ5qXCPZqYg4Jl1DrrixnWNMKylzgpmMWx0yNDYXlzw=="],
        [["packages","node_modules/@next/swc-win32-arm64-msvc","resolved"],"https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.3.4.tgz","https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-win32-arm64-msvc","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@next/swc-win32-x64-msvc","integrity"],ABSENT,"sha512-WcTlaKt/TWkh5kUjdJcUmB1XgZ+1c6fz4Y9fDHL73YNSdGaUWjceeWrrlwF0nv19iABYWC4iAq1oX1w4Bn0vfg=="],
        [["packages","node_modules/@next/swc-win32-x64-msvc","resolved"],ABSENT,"https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-16.3.8.tgz"],
        [["packages","node_modules/@next/swc-win32-x64-msvc","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/@nodelib/fs.scandir","integrity"],ABSENT,"sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g=="],
        [["packages","node_modules/@nodelib/fs.scandir","resolved"],ABSENT,"https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz"],
        [["packages","node_modules/@nodelib/fs.stat","integrity"],ABSENT,"sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A=="],
        [["packages","node_modules/@nodelib/fs.stat","resolved"],ABSENT,"https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz"],
        [["packages","node_modules/@nodelib/fs.walk","integrity"],ABSENT,"sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg=="],
        [["packages","node_modules/@nodelib/fs.walk","resolved"],ABSENT,"https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz"],
        [["packages","node_modules/eslint-config-next","dependencies","@next/eslint-plugin-next"],"16.3.4","16.3.8"],
        [["packages","node_modules/eslint-config-next","integrity"],ABSENT,"sha512-81vovwMe6NGnoFsl0KUJWzlS+y239i3fdsxs49gSEX3pDQW2cuKy+fxUPXNkQqqx6OCPheYPtBlSufc9aZ0k+w=="],
        [["packages","node_modules/eslint-config-next","resolved"],ABSENT,"https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-16.3.8.tgz"],
        [["packages","node_modules/eslint-config-next","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/fast-glob","integrity"],ABSENT,"sha512-kNFPyjhh5cKjrUltxs+wFx+ZkbRaxxmZ+X0ZU31SOsxCEtP9VPgtq2teZw1DebupL5GmDaNQ6yKMMVcM41iqDg=="],
        [["packages","node_modules/fast-glob","resolved"],ABSENT,"https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.1.tgz"],
        [["packages","node_modules/fast-glob/node_modules/glob-parent","integrity"],ABSENT,"sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow=="],
        [["packages","node_modules/fast-glob/node_modules/glob-parent","resolved"],ABSENT,"https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz"],
        [["packages","node_modules/fastq","integrity"],ABSENT,"sha512-XKv5nnLs6nLF71NgiKJLIZFLkPyIEuOselLG7ujZnGrRfQK8HpvY+WqKhAJUAdLomwVHErVS4LfxFlPq0/FTAw=="],
        [["packages","node_modules/fastq","resolved"],ABSENT,"https://registry.npmjs.org/fastq/-/fastq-1.20.3.tgz"],
        [["packages","node_modules/merge2","integrity"],ABSENT,"sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg=="],
        [["packages","node_modules/merge2","resolved"],ABSENT,"https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz"],
        [["packages","node_modules/next","dependencies","@next/env"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","integrity"],ABSENT,"sha512-U7QEZaTini6wKrb8A8hqLLqYQyCetegKjCpJOyxk642vWoMoU1x5PyZCJFvgYgiptA8xc5j/9xYlZFO7w9Sjmw=="],
        [["packages","node_modules/next","optionalDependencies","@next/swc-darwin-arm64"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-darwin-x64"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-linux-arm64-gnu"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-linux-arm64-musl"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-linux-x64-gnu"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-linux-x64-musl"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-win32-arm64-msvc"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","optionalDependencies","@next/swc-win32-x64-msvc"],"16.3.4","16.3.8"],
        [["packages","node_modules/next","resolved"],ABSENT,"https://registry.npmjs.org/next/-/next-16.3.8.tgz"],
        [["packages","node_modules/next","version"],"16.3.4","16.3.8"],
        [["packages","node_modules/queue-microtask","integrity"],ABSENT,"sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A=="],
        [["packages","node_modules/queue-microtask","resolved"],ABSENT,"https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz"],
        [["packages","node_modules/reusify","integrity"],ABSENT,"sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw=="],
        [["packages","node_modules/reusify","resolved"],ABSENT,"https://registry.npmjs.org/reusify/-/reusify-1.1.0.tgz"],
        [["packages","node_modules/run-parallel","integrity"],ABSENT,"sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA=="],
        [["packages","node_modules/run-parallel","resolved"],ABSENT,"https://registry.npmjs.org/run-parallel/-/run-parallel-1.2.0.tgz"],
      ] as const;
      for(const [jsonPath,baseline,successor] of successorDelta){
        const label=JSON.stringify(jsonPath);
        let parent: Record<string,unknown>=lock;
        for(const part of jsonPath.slice(0,-1)){
          expect(Object.hasOwn(parent,part),label).toBe(true);
          parent=parent[part] as Record<string,unknown>;
        }
        const field=jsonPath[jsonPath.length-1];
        expect(Object.hasOwn(parent,field),label).toBe(true);
        expect(parent[field],label).toBe(successor);
        if(baseline===ABSENT)delete parent[field];
        else parent[field]=baseline;
      }
      expect(lock.packages["apps/web"].dependencies.sharp).toBe("0.35.4");delete lock.packages["apps/web"].dependencies.sharp;
      const codec=lock.packages["node_modules/sharp"];expect(codec.version).toBe("0.35.4");
      expect(codec.resolved).toBe("https://registry.npmjs.org/sharp/-/sharp-0.35.4.tgz");
      expect(codec.integrity).toBe("sha512-n++8XWcj+jCOr2IOl7h8LbKnGBDY4aPbmprMONBNFdn0ImXqpGVv5zliDs0V9HbmbCQLpbuo2ej9rAoOQTvMDA==");
      delete codec.resolved;delete codec.integrity;
      for(const key of ["node_modules/sharp","node_modules/@img/colour","node_modules/sharp/node_modules/semver"]){
        expect(lock.packages[key].optional).toBeUndefined();
        lock.packages[key]=Object.fromEntries(Object.entries(lock.packages[key]).flatMap(([k,v])=>k==="license"?[[k,v],["optional",true]]:[[k,v]]));
      }
      canonical=JSON.stringify(lock,null,2)+"\n";
    }
    expect(createHash("sha256").update(canonical).digest("hex"),path).toBe(expected);
  }
  const manifest=JSON.parse(await readFile("packages/persistence-postgres/package.json","utf8"));
  expect(manifest.exports["./b5"]).toBe("./src/b5/index.ts"); delete manifest.exports["./b5"];
  // Successor scope issue69 adds an isolated entry; the original public root stays frozen.
  expect(manifest.exports["./core-flow"]).toBe("./src/core-flow.ts"); delete manifest.exports["./core-flow"];
  // PR70 authorization5969526294 adds only this successor capability entry.
  expect(manifest.exports["./core-onboarding"]).toBe("./src/core-onboarding.ts"); delete manifest.exports["./core-onboarding"];
  expect(manifest).toEqual({"name": "@build-manager/persistence-postgres", "version": "0.0.0", "private": true, "type": "module", "exports": {".": "./src/index.ts", "./testing": "./src/testing/index.ts", "./b1": "./src/b1/index.ts", "./b3": "./src/b3/index.ts", "./b4": "./src/b4/index.ts"}, "dependencies": {"pg": "8.23.0", "@build-manager/application": "0.0.0"}, "devDependencies": {"@testcontainers/postgresql": "12.1.0", "@types/pg": "8.23.1", "node-pg-migrate": "9.0.0"}});
});
it("AC01 B5 server graph excludes raw driver/demo/testing and exposes only the exact individual route",async()=>{
  const entries=(await readdir("apps/web/src/server/b5")).filter(p=>p.endsWith(".ts")&&!p.endsWith(".test.ts")).map(p=>join("apps/web/src/server/b5",p));
  for(const path of entries) {
    const imports=moduleEdges(await readFile(path,"utf8")).map(e=>e.specifier);
    expect(imports.some(i=>/^(?:pg|node:sqlite)$|fixture|testing|demo|persistence-postgres/.test(i))).toBe(false);
  }
  expect(await scanB1ProductionGraph(process.cwd(),entries)).toEqual([]);
  async function files(dir:string):Promise<string[]> { return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(r=>r.isDirectory()?files(join(dir,r.name)):[join(dir,r.name).replaceAll("\\","/")]))).flat(); }
  const appFiles=await files("apps/web/src/app");
  expect(appFiles.filter(p=>/memberships|roster|profile|reactivat|role-mutation|staff-search/.test(p))).toEqual(["apps/web/src/app/api/v2/organizations/[orgId]/memberships/[membershipId]/route.ts"]);
  expect((await files("apps/web/src/components")).some(p=>/\/b5\//.test(p))).toBe(false);
  const route=await readFile(appFiles.find(p=>p.includes("/memberships/"))!,"utf8");
  expect(route).toContain('export const runtime = "nodejs";'); expect(route).toContain('export const dynamic = "force-dynamic";');
  for(const method of ["GET","PUT","DELETE","POST","PATCH","HEAD","OPTIONS"]) expect(route).toContain(`export async function ${method}(`);
});
it("B5 uses one existing pool and one command with no alternate membership DML",async()=>{
  const port=await readFile("packages/persistence-postgres/src/b5/membership-termination.ts","utf8");
  expect(port.match(/SELECT authn\.b5_end_organization_membership/g)).toHaveLength(1);
  expect(port).not.toMatch(/app\.organization_membership|\b(?:INSERT|UPDATE|DELETE)\b|new Pool|new Client/);
  const container=await readFile("apps/web/src/server/b1/container.ts","utf8");
  expect(container.match(/createPostgresDatabase\(/g)).toHaveLength(1);
  expect(container).toContain("createOrganizationMembershipTerminationPort(database)");
  const transaction=await readFile("packages/persistence-postgres/src/b5/transaction.ts","utf8");
  expect(transaction).not.toMatch(/new Pool|new Client|NODE_OPTIONS/);
});
