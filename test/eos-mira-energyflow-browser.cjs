/** Exercise the shipped Live page with a local snapshot server and simulated electrical measurements. */
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer');
const web = path.resolve(__dirname,'../ui/www');
async function main() {
    const consumers = Array.from({length:10}, (_, index) => ({
        idx: index+1, name: index===9 ? 'MIRA 1' : 'Verbraucher '+(index+1), mapped:true,
        stateKey:'consumer'+(index+1)+'Power', consumerType:index===9?'heatPump':'generic',
        qc:index===9?{enabled:true,controlKind:'thermal',ovumMira:true,max:3500,hasBoost:true}: {enabled:false},
    }));
    const datapoints = {consumptionTotal:'meter.building',gridPointPower:'meter.grid',batteryPower:'meter.battery'};
    const watts = {'derived.core.pv.totalW':0,consumptionTotal:2630,gridPointPower:2630,batteryPower:0,storageSoc:55};
    for (const c of consumers) { watts[c.stateKey]=c.idx===10?1730:0; datapoints[c.stateKey]='fixture.'+c.stateKey; }
    const sample = () => Object.fromEntries(Object.entries(watts).map(([k,value])=>[k,{value,ts:Date.now(),q:0,ack:true}]));
    const sockets=new Set(); const commands=[]; const errors=[];
    let mode = 'inherit';
    const modes = [{value:'inherit', label:'System'}, {value:'pvAuto', label:'Auto (PV)'},
        {value:'manual', label:'Geräteregelung'}, {value:'off', label:'PV-Anforderung aus'}];
    const server=http.createServer(async (req,res)=>{
        const url=new URL(req.url,'http://localhost');
        const json=(x)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));};
        if(url.pathname==='/config') return json({datapoints,flowSlots:{consumers,producers:[]},units:{power:'kW'},settings:{deviceStaleTimeoutSec:90}});
        if(url.pathname==='/events'){
            res.writeHead(200,{'content-type':'text/event-stream'});sockets.add(res);res.on('close',()=>sockets.delete(res));
            return res.write('data: '+JSON.stringify({type:'init',payload:sample()})+'\n\n');
        }
        if(url.pathname==='/api/state') return json(sample());
        if(url.pathname==='/api/auth/idle') return json({authenticated:true,kiosk:true,serverNow:Date.now(),idleExpiresAt:null,idleTimeoutMs:0,sessionKey:'kiosk:mira-dashboard-test',csrfToken:'a'.repeat(64)});
        if(url.pathname==='/api/auth/status') return json({authed:true,authenticated:true,configured:true,kiosk:true,enabled:true,kioskEnabled:true,mode:'kiosk',protectWrites:true,role:'customer',user:null,userId:null,csrfToken:'a'.repeat(64),capabilities:['frontend.open']});
        if(url.pathname==='/api/flow/qc/read'){
            if(url.searchParams.get('kind') !== 'consumer' || url.searchParams.get('idx') !== '10') return json({ok:false});
            return json({ok:true,thermal:{available:true,ovumMira:true,cfgEnabled:true,cfgMode:'pvAuto',userEnabled:true,
                userMode:mode,effectiveMode:mode==='inherit'?'pvAuto':mode,effectiveEnabled:true,modes}});
        }
        if(url.pathname==='/api/set'){
            if (req.method !== 'POST' || req.headers['x-nw-csrf'] !== 'a'.repeat(64)) {res.statusCode=403;return json({ok:false});}
            let buf=''; for await(const b of req)buf+=b;
            const command=JSON.parse(buf);commands.push(command);
            if(command.scope==='flow' && command.key==='consumer.10.mode' && command.value==='off') mode='off';
            return json({ok:true});
        }
        if(url.pathname.startsWith('/api/'))return json({});
        const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const candidates=[path.resolve(web,name),path.resolve(web,name.replace(/^static\//,''))];
        for(const file of candidates)if(file.startsWith(web+path.sep)){
            let bytes; try {bytes=await fs.readFile(file);}catch{continue;}
            res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'})[path.extname(name)]||'application/octet-stream');
            return res.end(bytes);
        }
        res.writeHead(404);res.end();
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    let browser;
    try {
        browser=await puppeteer.launch({executablePath:process.env.EOS_CHROMIUM_PATH||puppeteer.executablePath(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
        const page=await browser.newPage();
        page.on('pageerror', e=>errors.push(e.message));
        await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.querySelector('#val_consumer10')?.textContent.includes('1.7'),{timeout:20000});
        const read=()=>page.evaluate(()=>Object.fromEntries(['centerPower','sideBuildingPower','sideConsumptionTotal','val_consumer10'].map(id=>[id,document.getElementById(id)?.textContent])));
        const values=await read();
        assert.deepEqual(values,{centerPower:'0.9 kW',sideBuildingPower:'0.9 kW',sideConsumptionTotal:'2.6 kW',val_consumer10:'1.7 kW'});
        await page.click('#node_consumer10 circle');
        await page.waitForFunction(()=>document.querySelector('#flowQcModeButtons button[data-mode="off"]')?.textContent==='PV-Anforderung aus');
        const modal = await page.evaluate(()=>({
            title:document.querySelector('#flowQcTitle').textContent,measurement:document.querySelector('#flowQcPower').textContent,
            modes:Array.from(document.querySelectorAll('#flowQcModeButtons button'),el=>el.textContent)
        }));
        assert.deepEqual(modal,{title:'MIRA 1',measurement:'1.73 kW',modes:modes.map(m=>m.label)});
        assert.equal(await page.$eval('#flowQcSetpointWrap',el=>getComputedStyle(el).display),'none');
        assert.equal(await page.$eval('#flowQcSwitchWrap',el=>getComputedStyle(el).display),'none');
        await Promise.all([
            page.waitForResponse(r => new URL(r.url()).pathname === '/api/set' && r.status() === 200),
            page.click('#flowQcModeButtons button[data-mode="off"]'),
        ]);
        assert.ok(commands.some(x=>x.scope==='flow'&&x.key==='consumer.10.mode'&&x.value==='off'),JSON.stringify(commands));
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({result:'passed',browser:await browser.version(),scope:'Lokaler HTTP/SSE-Server mit simulierten Messungen und EMS-Quittung. Produktiver Dashboard-Code, keine Hardware.',tenMappedConsumers:consumers.length,values,modal,commands,scriptSha256:createHash('sha256').update(await fs.readFile(path.join(web,'app.js'))).digest('hex')}));
    } finally { if(browser)await browser.close();for(const s of sockets)s.end();server.closeAllConnections();await new Promise(r=>server.close(r)); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
