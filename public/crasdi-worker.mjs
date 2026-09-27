// All research computation is device-local. No user input is interpolated into Python source.
let runtime;
const files=['__init__.py','CRASDI.py','CRASDI_helpers.py','matching.py','vectorize.py','web_runner.py'];
async function boot(){
 self.postMessage({type:'status',message:'Downloading the Python runtime and scientific packages. First use may take a minute.'});
 const {loadPyodide}=await import('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs');
 const py=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'});
 await py.loadPackage(['numpy','scipy','shapely','matplotlib','scikit-image','pillow']);
 py.FS.mkdirTree('/home/pyodide/crasdi');
 await Promise.all(files.map(async name=>{const r=await fetch('/crasdi/'+name);if(!r.ok)throw Error('Research code could not load. Please retry.');py.FS.writeFile('/home/pyodide/crasdi/'+name,await r.text());}));
 await py.runPythonAsync("import matplotlib\nmatplotlib.use('Agg')\nfrom crasdi.web_runner import run_request");
 return py;
}
let busy=false;
self.onmessage=async ({data})=>{
 if(busy)return;
 busy=true;
 try{
  const py=await (runtime??=boot());
  self.postMessage({type:'running'});
  py.globals.set('request_json',JSON.stringify(data));
  const output=await py.runPythonAsync('run_request(request_json)');
  self.postMessage({type:'result',result:JSON.parse(output)});
 }catch(e){runtime=undefined;self.postMessage({type:'error',message:String(e?.message||e).split('\n').slice(-3).join(' ').slice(0,700)});}
 finally{busy=false;}
};
