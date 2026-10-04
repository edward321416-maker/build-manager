import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname } from "node:path";
// Development entry only; resolve the actual workspace source graph.
const roots=["persistence-postgres","application","domain"].map(n=>new URL(`../packages/${n}/src/`,import.meta.url).href);
registerHooks({resolve(specifier,context,next){
  if(/^\.\.?\//.test(specifier)&&context.parentURL&&roots.some(r=>context.parentURL.startsWith(r))){
    const target=new URL(specifier,context.parentURL);
    if((!extname(specifier)||/\/(heating|leak)\.v1$/.test(target.pathname))&&roots.some(r=>target.href.startsWith(r))){
      for(const suffix of [".ts","/index.ts"]){const candidate=new URL(target.href+suffix);if(existsSync(fileURLToPath(candidate)))return next(candidate.href,context);}
    }
  }
  return next(specifier,context);
}});
