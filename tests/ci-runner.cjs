/* Keep short, actionable diagnostics visible in the CI job's step names. */
'use strict';
const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const commands=process.argv.slice(2);let failure='';
for(const command of commands){const result=spawnSync('npm',['run',command],{encoding:'utf8',maxBuffer:8*1024*1024});const log=(result.stdout||'')+(result.stderr||'');process.stdout.write(log);if(result.status!==0){const lines=log.split(/\r?\n/);const detail=lines.find(x=>/^(?:Error:|ReferenceError:|TypeError:|AssertionError|\s*page\.|\s*locator\.|\s*browserType\.)/.test(x))||lines.find(x=>/Error|failed|FAIL/i.test(x))||`Exit ${result.status}`;failure=`${command}: ${detail.trim()}`.replace(/\s+/g,' ').slice(0,220);break;}}
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`detail=${failure||'Passed'}\n`);
if(failure){console.error(failure);process.exitCode=1;}
