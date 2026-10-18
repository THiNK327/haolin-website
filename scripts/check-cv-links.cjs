const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve('dist/client');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.rsc':'text/x-component','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{
 let requested;
 try{requested=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
 catch{res.writeHead(400);return res.end();}
 if(!requested.startsWith(root+path.sep)&&requested!==root){res.writeHead(403);return res.end();}
 const file=[requested,requested+'.html',path.join(requested,'index.html')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!file){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 const errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url())});
 const origin='http://127.0.0.1:4174';
 try{
  await page.goto(origin+'/');
  await page.getByRole('heading',{name:'Hi, I’m Haolin.',exact:true}).waitFor();
  const hero=page.locator('.profile-copy');
  const primary=hero.getByRole('link',{name:'Try CRASDI examples',exact:true});
  assert.equal(await primary.getAttribute('href'),'/playground/crasdi#example');
  assert.match(await primary.getAttribute('class'),/button/);
  assert.equal(await page.locator('.profile-side .research-tool-cta').count(),0,'The rejected sidebar preview card must stay removed');
  assert.equal(await page.locator('.profile-side .research-tool-preview').count(),0);
  assert.equal(await page.locator('.profile-side img').count(),1,'Keep only the portrait in the sidebar');
  assert.equal(await page.locator('.profile-side img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true);
  const cv=hero.getByRole('link',{name:'Download my CV',exact:true});
  assert.equal(await cv.getAttribute('href'),'/Haolin_Wang_Academic_CV_v6.pdf');
  const pdf=await page.request.get(origin+await cv.getAttribute('href'));
  const old=await page.request.get(origin+'/Haolin_Wang_CV.pdf');
  assert.equal(pdf.status(),200);assert.equal(old.status(),200);
  assert.equal((await pdf.body()).subarray(0,5).toString(),'%PDF-');
  assert.deepEqual(await pdf.body(),await old.body());
  await page.screenshot({path:'/tmp/haolin-static-cv-v6-home-desktop.png',fullPage:true});
  for(const width of [320,390,768,1024,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Homepage overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/haolin-static-cv-v6-home-mobile.png',fullPage:true});
  await primary.click();
  await page.getByRole('button',{name:/Small displacement/}).waitFor();
  assert.equal(await page.locator('input[type=file]').count(),0);
  await page.getByRole('link',{name:'Research behind CRASDI',exact:true}).click();
  await page.locator('#research-crasdi').waitFor({state:'visible'});
  assert.equal(await page.getByRole('tab',{name:'Research',exact:true}).getAttribute('aria-selected'),'true');
  await page.waitForFunction(()=>Math.abs(document.getElementById('research-crasdi').getBoundingClientRect().top)<150);
  await page.setViewportSize({width:1360,height:1000});
  await page.locator('#research-crasdi').scrollIntoViewIfNeeded();
  await page.screenshot({path:'/tmp/haolin-static-cv-v6-research.png',fullPage:false});
  for(const [slug,id,title] of [['lane-marking','research-lane-marking','Lane Marking Detection'],['alligator-cracking','research-crack-density','Alligator Crack Detection']]){
   await page.goto(origin+'/playground/'+slug);
   await page.getByRole('link',{name:'Research behind '+title,exact:true}).click();
   await page.locator('#'+id).waitFor({state:'visible'});
   const card=page.locator('#'+id+' .research-tool-cta');
   assert.match(await card.innerText(),/Coming soon/);
   assert.equal(await card.getByRole('link',{name:'View planned module',exact:true}).count(),1);
   assert.equal(await card.getByRole('link',{name:/Try .* examples/}).count(),0);
  }
  for(const tab of ['Skills','Research','Publications','Resources','Background','Teaching','Service','Contact']){
   await page.getByRole('tab',{name:tab,exact:true}).click();
   for(const width of [320,390,1360]){
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,tab+' overflow at '+width);
   }
  }
  await page.getByRole('tab',{name:'Background',exact:true}).click();
  await page.getByRole('heading',{name:'M.S. in Computer Science & Engineering',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Undergraduate Researcher',exact:true}).waitFor();
  await page.locator('#background').getByRole('link',{name:'Try CRASDI examples',exact:true}).waitFor();
  await page.getByRole('tab',{name:'Teaching',exact:true}).click();
  assert.match(await page.locator('#teaching').innerText(),/five-lab Python curriculum/);
  assert.doesNotMatch(await page.locator('#teaching').innerText(),/Institute-wide/);
  await page.getByRole('tab',{name:'Research',exact:true}).click();
  assert.doesNotMatch(await page.locator('#research').innerText(),/11,468|ten solvers/);
  assert.deepEqual(errors,[]);assert.deepEqual(api,[]);
  console.log('PASS: CV v6 PDF/alias, no sidebar preview card, retained actions, research-to-tool round trips, planned statuses, source updates, 320–1440px layouts, and zero API calls.');
 }catch(error){
  console.error(JSON.stringify({url:page.url(),errors,api,body:(await page.locator('body').innerText()).slice(0,18000)}));
  await page.screenshot({path:'/tmp/haolin-static-cv-v6-failure.png',fullPage:true}).catch(()=>{});
  throw error;
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exit(1)});
