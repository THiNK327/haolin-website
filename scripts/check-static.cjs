const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve('dist/client');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.rsc':'text/x-component'};
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)&&fs.existsSync(file+'.html'))file+='.html';
 if(!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url())});
 await page.goto('http://localhost:4173/playground');
 await page.getByRole('button',{name:/Small displacement/}).click();
 await page.locator('.comparison-total').filter({hasText:'0.250'}).waitFor();
 await page.getByRole('combobox',{name:'Matching radius (pixels)'}).click();
 await page.getByRole('option',{name:'1 px',exact:true}).click();
 await page.locator('.comparison-total').filter({hasText:'1.000'}).waitFor();
 await page.getByRole('button',{name:'Reset settings'}).click();
 await page.locator('.comparison-total').filter({hasText:'0.250'}).waitFor();
 await page.getByRole('button',{name:/Wider & longer/}).click();
 await page.locator('.comparison-total').filter({hasText:'0.210'}).waitFor();
 await page.getByRole('combobox',{name:'Compare using'}).click();
 await page.getByRole('option',{name:'Geometry only',exact:true}).click();
 await page.locator('.comparison-total').filter({hasText:'0.226'}).waitFor();
 await page.getByRole('combobox',{name:'Resolution (mm / pixel)'}).click();
 await page.getByRole('option',{name:'8 mm / pixel',exact:true}).click();
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export result',exact:true}).click();const downloaded=await dl;
 const fs=require('fs');const exported=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));if(exported.parameters.pixel_size!==8||exported.parameters.mode!=='geom')throw Error('Bad export');
 await page.screenshot({path:'/tmp/haolin-static-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/haolin-static-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
 if(await page.getByText(/Try your maps|Server Python|Email verification for custom runs/).count())throw Error('Old flow visible');
 await page.goto('http://localhost:4173/');await page.getByRole('heading',{name:/Haolin/}).first().waitFor();
 await page.getByRole('tab',{name:'Skills',exact:true}).waitFor();
 await page.setViewportSize({width:1360,height:1000});
 const bounds=await page.getByRole('tab',{name:'Skills',exact:true}).locator('..').evaluate(list=>{
  const row=list.getBoundingClientRect();
  return {left:row.left,right:row.right,tabs:[...list.querySelectorAll('[role=tab]')].map(t=>{const r=t.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})};
 });
 if(bounds.tabs.length!==6||Math.max(...bounds.tabs.map(t=>t.width))-Math.min(...bounds.tabs.map(t=>t.width))>1||Math.abs(bounds.tabs[0].left-bounds.left)>1||Math.abs(bounds.tabs[5].right-bounds.right)>1)throw Error('Profile tabs do not fill the row evenly: '+JSON.stringify(bounds));
 await page.setViewportSize({width:390,height:844});
 if(await page.getByRole('tabpanel').count()!==1)throw Error('Only the selected profile section should be visible');
 await page.getByRole('tab',{name:'Current research',exact:true}).click();
 await page.getByRole('heading',{name:'Pavement crack digital twin',exact:true}).waitFor();
 if(await page.locator('#skills').isVisible())throw Error('Inactive skills section is visible');
 await page.getByRole('tab',{name:'Current research',exact:true}).press('ArrowRight');
 await page.getByRole('heading',{name:'Education & experience',exact:true}).waitFor();
 await page.goto('http://localhost:4173/#contact');
 await page.getByRole('heading',{name:'Let’s connect',exact:true}).waitFor();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Profile tabs cause horizontal overflow');

 const response=await page.request.get('http://localhost:4173/api/playground/session');if(response.status()!==404)throw Error('API route still active');
 if(errors.length||api.length)throw Error(JSON.stringify({errors,api}));
 console.log('PASS: static pages, controls, matching changes, export, mobile layout, no API requests, removed API returns 404.');
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
