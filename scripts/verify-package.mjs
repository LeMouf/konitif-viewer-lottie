import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
assert.equal(manifest.name,'@konitif/viewer-lottie');
assert.equal(manifest.private,false);
assert.equal(manifest.publishConfig.access,'public');
assert.equal(manifest.publishConfig.tag,'next');
assert.equal(manifest.devDependencies.typescript,'5.9.3');
assert.equal(lock.packages[''].devDependencies.typescript,'5.9.3');
for(const [name,entry] of Object.entries(lock.packages)){
  assert.notEqual(entry.link,true,'Local link in lockfile: '+name);
  if(entry.resolved)assert.match(entry.resolved,/^https:\/\/registry\.npmjs\.org\//,'Non-registry resolution: '+name);
}
for(const entry of Object.values(manifest.exports))for(const file of [entry.import,entry.types])assert.ok(existsSync(join(root,file)),'Missing export '+file);
const canvas=await import(pathToFileURL(join(root,'dist/canvas.js')).href);
assert.equal(typeof canvas.createLottieCanvasOutput,'function');
assert.equal(canvas.LOTTIE_CANVAS_MAX_DIMENSION,2048);
const vendor=readFileSync(join(root,'node_modules/lottie-web/build/player/lottie_light_canvas.js'));
const evidence=JSON.parse(readFileSync(join(root,'qualification/canvas-output.v1.json'),'utf8'));
assert.equal(createHash('sha256').update(vendor).digest('hex'),evidence.vendor.sha256);
const npmCli=process.platform==='win32'?join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'):join(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
assert.ok(existsSync(npmCli),'Existing npm CLI required');
const destination=mkdtempSync(join(tmpdir(),'konitif-viewer-lottie-package-'));
const packed=JSON.parse(execFileSync(process.execPath,[npmCli,'pack','--offline','--ignore-scripts','--json','--pack-destination',destination],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,env:{...process.env,npm_config_update_notifier:'false'}}))[0];
const files=packed.files.map(file=>file.path);
for(const required of ['dist/canvas.js','dist/canvas.d.ts','dist/canvasRenderer.js','dist/canvasRenderer.d.ts','LICENSE.md','THIRD_PARTY_NOTICES.md','licenses/lottie-web-MIT.txt','RELEASE.md','qualification/canvas-output.v1.json'])assert.ok(files.includes(required),'Missing packed file '+required);
for(const file of files)assert.match(file,/^(dist\/|qualification\/|licenses\/|package\.json$|README\.md$|RELEASE\.md$|CHANGELOG\.md$|LICENSE\.md$|THIRD_PARTY_NOTICES\.md$)/,'Unexpected packed file '+file);
process.stdout.write(JSON.stringify({package:manifest.name,version:manifest.version,files:files.length,bytes:packed.size,exportAndNoticeChecks:'passed',registryOnlyLockfile:true})+'\n');
