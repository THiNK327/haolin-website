import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

/** A temporary test app, never included in the production routes or static export. */
export async function checkEntryGate(browser) {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.playground-gate-test-'));
  let server;
  let page;
  try {
    await fs.writeFile(path.join(root, 'index.html'), '<div id="root"></div><script type="module" src="/main.tsx"></script>');
    await fs.writeFile(path.join(root, 'main.tsx'), `
      import React, {useCallback, useRef, useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {EntryGate} from '../components/playground/entry-gate';
      function App(){
        const [scenario,setScenario]=useState('verify');
        const verified=useRef(false);
        const check=useCallback(async()=>{
          window.gateChecks=(window.gateChecks||0)+1;
          if(scenario==='error')throw Error('Test service unavailable');
          if(scenario==='deny')return {status:'denied',message:'Test quota exhausted'};
          if(scenario==='missing')return {status:'verification-required',method:'unregistered'};
          if(scenario==='slow')await new Promise(resolve=>setTimeout(resolve,250));
          return scenario==='open'||scenario==='slow'||verified.current ? {status:'allowed'} : {status:'verification-required',method:'test'};
        },[scenario]);
        const providers={test:({onComplete})=><button onClick={()=>{verified.current=true;onComplete()}}>Confirm test verification</button>};
        return <><nav>{['verify','open','deny','missing','error','slow'].map(name=><button key={name} onClick={()=>{verified.current=false;setScenario(name)}}>{name}</button>)}</nav>
          <EntryGate toolId="test-tool" checkAccess={check} verificationProviders={providers}>
            <label>Test upload<input type="file"/></label>
          </EntryGate></>;
      }
      createRoot(document.getElementById('root')).render(<App/>);
    `);
    server = await createServer({
      configFile: false,
      root,
      plugins: [react()],
      server: { host: '127.0.0.1', port: 0, fs: { allow: [process.cwd()] } },
      logLevel: 'error',
    });
    await server.listen();
    const address = server.httpServer.address();
    page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByRole('button', { name: 'Confirm test verification' }).waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0, 'No uploads before verification');
    await page.getByRole('button', { name: 'Confirm test verification' }).click();
    await page.getByLabel('Test upload').waitFor();
    assert.equal(await page.evaluate(() => window.gateChecks), 2, 'Verification must recheck the server rather than locally grant access');
    await page.getByRole('button', { name: 'deny', exact: true }).click();
    await page.getByText('Test quota exhausted', { exact: true }).waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0);
    await page.getByRole('button', { name: 'missing', exact: true }).click();
    await page.getByText('Verification is not available for this tool yet.', { exact: false }).waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0, 'An unimplemented provider must fail closed');
    await page.getByRole('button', { name: 'error', exact: true }).click();
    await page.getByRole('button', { name: 'Retry access check' }).waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0);
    await page.getByRole('button', { name: 'open', exact: true }).click();
    await page.getByLabel('Test upload').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirm test verification' }).count(), 0);
    await page.getByRole('button', { name: 'slow', exact: true }).click();
    await page.getByRole('button', { name: 'deny', exact: true }).click();
    await page.getByText('Test quota exhausted', { exact: true }).waitFor();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('input[type=file]').count(), 0, 'A stale response must not unlock a denied workspace');
    assert.deepEqual(errors, []);
    console.log('PASS: verification precedes upload; open, verified, denied, missing-provider, error, and stale-response entry states.');
  } finally {
    await page?.close();
    await server?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
