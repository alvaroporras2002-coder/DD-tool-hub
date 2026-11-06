/* Read-only diagnostics for the most recent completed Pages deployment. */
'use strict';
const fs=require('node:fs');
(async()=>{
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;if(!repo||!token)throw new Error('GitHub Actions context is required');
 const read=async endpoint=>{const response=await fetch(`https://api.github.com/repos/${repo}/${endpoint}`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!response.ok)throw new Error(`GitHub API ${response.status} reading deployment diagnostics`);return response.json();};
 const runs=await read('actions/runs?per_page=20');const previous=runs.workflow_runs.find(run=>run.name==='pages build and deployment'&&run.status==='completed');
 let detail='No completed Pages deployment';
 if(previous?.conclusion==='success')detail='Previous Pages deployment succeeded';
 else if(previous){const jobs=await read(`actions/runs/${previous.id}/jobs`);const failed=jobs.jobs.filter(job=>job.conclusion==='failure');const messages=[];for(const job of failed){const notes=await read(`check-runs/${job.id}/annotations`);for(const note of notes)if(note.annotation_level==='failure'||/error|timed out|timeout/i.test(note.message||''))messages.push(note.message||note.title||'');}detail=`Previous Pages: ${messages.join(' | ')||previous.conclusion}`.replace(/\s+/g,' ').slice(0,225);}
 console.log(detail);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`detail=${detail}\n`);
})().catch(error=>{const detail=`Diagnostic unavailable: ${error.message}`.replace(/\s+/g,' ').slice(0,225);console.error(detail);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`detail=${detail}\n`);});
