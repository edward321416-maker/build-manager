import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const evidence = join(homedir(), ".build-manager-rc1-private", "design-20261004");
const viewports = [{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1280,height:900},{width:1440,height:900}];
class DesignScreen {
  constructor(readonly page: Page) {}
  async login() {
    const codes = JSON.parse(await readFile(join(homedir(), ".build-manager-rc1-private", "access-codes.json"), "utf8"));
    await this.page.goto("/core");
    await this.page.getByLabel("개발 접근 코드").fill(codes.tenant);
    await this.page.getByRole("button", {name:"들어가기",exact:true}).click();
    await expect(this.page.getByLabel("문제 설명")).toBeVisible();
  }
  async fits() {
    expect(await this.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const geometry = await this.page.getByRole("button").evaluateAll(buttons => buttons.map(b => {
      const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};
    }).filter(r=>r.width>0 && r.height>0));
    expect(geometry.every(r=>r.height>=44 && r.left>=0 && r.right<=this.page.viewportSize()!.width)).toBe(true);
  }
}

test("design reflow keeps the same draft and File through five widths, text scaling and keyboard photo dialog", async ({page}) => {
  await mkdir(evidence,{recursive:true});
  const screen=new DesignScreen(page);await screen.login();
  await expect(page.getByText("개발 환경 · 합성 데이터",{exact:true})).toBeVisible();
  const disclosure=page.getByRole("complementary",{name:"개발 환경 안내"}).locator("details");
  await expect(disclosure).not.toHaveAttribute("open","");
  const description="합성 디자인 검사: 난방에 대한 긴 설명입니다. ".repeat(8);
  await page.getByLabel("문제 설명").fill(description);
  const bytes=await sharp({create:{width:240,height:160,channels:3,background:"#d7dde5"}}).png().toBuffer();
  const picker=page.getByLabel("참고 사진 선택",{exact:true});
  await expect(picker).toHaveAttribute("type","file");await expect(picker).toHaveAttribute("accept","image/jpeg,image/png");await expect(picker).toHaveAttribute("multiple","");
  await picker.focus();await expect(picker).toBeFocused();
  expect(await picker.evaluate(el=>getComputedStyle(el.parentElement!).outlineStyle)).toBe("solid");
  expect(await picker.evaluate(el=>getComputedStyle(el.parentElement!).display)).toBe("flex");
  await expect(picker).toBeEnabled();await expect(picker).toBeFocused();
  // Space activates the focused native file control without the form's Enter semantics.
  const keyboardChooser=page.waitForEvent("filechooser");await picker.press("Space");
  await (await keyboardChooser).setFiles({name:"synthetic-design.png",mimeType:"image/png",buffer:bytes});
  await expect(page.getByText("사진 1장 선택됨",{exact:true})).toBeVisible();
  const original=await page.getByLabel("문제 설명").elementHandle();
  const preview=await page.getByAltText("전송 전 사진 1 미리보기").getAttribute("src");
  for(const viewport of viewports){
    await page.setViewportSize(viewport);await screen.fits();
    await expect(page.getByLabel("문제 설명")).toHaveValue(description);
    expect(await original!.evaluate(el=>el===document.querySelector('[aria-label="문제 설명"]'))).toBe(true);
    await expect(page.getByAltText("전송 전 사진 1 미리보기")).toHaveAttribute("src",preview!);
    await page.screenshot({path:join(evidence,`tenant-draft-${viewport.width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");await screen.fits();
  await page.screenshot({path:join(evidence,"tenant-text-200.png"),fullPage:true});
  await page.evaluate(()=>document.documentElement.style.removeProperty("font-size"));
  await page.setViewportSize({width:320,height:844});await screen.fits();
  // 320 CSS px reflow represents the 1280/400% layout condition; it is separate from text scaling.
  const submit=page.getByRole("button",{name:"접수하기",exact:true});await submit.focus();
  await expect(submit).toBeFocused();
  await page.keyboard.press("Shift+Tab");await page.keyboard.press("Tab");await expect(submit).toBeFocused();
  expect(await submit.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("Enter");
  const saved=page.getByRole("region",{name:"저장된 참고 사진",exact:true});
  const enlarge=saved.getByRole("button",{name:"저장된 사진 1 확대"});await expect(enlarge).toBeVisible();
  await expect(page.getByRole("heading",{name:"접수 상세",exact:true})).toBeFocused();
  await enlarge.focus();await page.keyboard.press("Enter");await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({path:join(evidence,"photo-dialog-320.png"),fullPage:true});
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();await expect(enlarge).toBeFocused();
  await screen.fits();
  const labelChooser=page.waitForEvent("filechooser");await page.getByText("참고 사진 추가",{exact:false}).click();
  await (await labelChooser).setFiles({name:"pending-design.png",mimeType:"image/png",buffer:bytes});
  await page.setViewportSize({width:1440,height:900});await expect(page.getByRole("button",{name:"← 목록으로",exact:true})).toBeDisabled();
  await expect(page.getByAltText("전송 전 사진 1 미리보기")).toBeVisible();
  await page.getByRole("button",{name:"사진 1 선택 취소",exact:true}).click();
  await expect(page.getByRole("button",{name:"← 목록으로",exact:true})).toBeEnabled();
});
