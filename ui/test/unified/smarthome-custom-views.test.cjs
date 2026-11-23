/* Copyright (c) 2026 NexoWatt. All rights reserved. */
'use strict';
// Exercises the actual strict helper + locally bundled GFM parser. Minimal DOM, no visual claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-custom-views.ts');
const source = process.env.EOS_TEST_CUSTOM_VIEWS_RUNTIME === 'build' ? fs.readFileSync(path.resolve(__dirname, '../../www/smarthome-custom-views.js'), 'utf8') : ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const parser = fs.readFileSync(path.resolve(__dirname, '../../www/smarthome-markdown-parser.js'), 'utf8');
function fixture(fetcher) {
  const timers = new Map(), requests = [], posts = [], navigations = [], events = [];
  let nextTimer = 0, now = Date.UTC(2026,5,21,12);
  class Element {
    constructor(tag='div') { this.tagName=tag.toUpperCase(); this.children=[]; this.parentElement=null; this.className=''; this.dataset={}; this.attributes={}; this.ownText=''; this.listeners=new Map(); this.disabled=false; this.value=''; this.style={properties:{},setProperty:(k,v)=>{this.style.properties[k]=v;}}; this.classList={add:(...v)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...v])].join(' ');},contains:v=>this.className.split(' ').includes(v),toggle:(v,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));(on===undefined?!set.has(v):on)?set.add(v):set.delete(v);this.className=[...set].join(' ');}}; }
    get textContent(){return this.ownText+this.children.map(n=>n.textContent).join('');} set textContent(v){this.ownText=String(v); for(const child of this.children) child.parentElement=null;this.children=[];}
    get innerHTML(){throw Error('HTML serialization forbidden');} set innerHTML(v){assert.equal(this.tagName,'I','Only bundled named-character decoder uses inert <i>');assert.ok(/^&[a-zA-Z0-9]+;$/.test(v));this.textContent=({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[v]||v;}
    get childNodes(){return this.children;} get isConnected(){return this===document.body || Boolean(this.parentElement?.isConnected);}
    append(...nodes){for(const n of nodes){if(n.parentElement)n.remove();n.parentElement=this;this.children.push(n);if(this.tagName==='SELECT' && this.children.length===1)this.value=n.value;}}
    appendChild(n){this.append(n);return n;} prepend(...nodes){for(const n of [...nodes].reverse()){if(n.parentElement)n.remove();n.parentElement=this;this.children.unshift(n);}}
    replaceChildren(...nodes){this.textContent='';this.append(...nodes);} remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
    setAttribute(k,v){this.attributes[k]=String(v);} getAttribute(k){return this.attributes[k]??null;} removeAttribute(k){delete this.attributes[k];} contains(n){return n===this||this.children.some(c=>c.contains(n));}
    addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,[]);this.listeners.get(k).push(fn);}
    click(){for(const fn of this.listeners.get('click')||[])fn({stopPropagation(){},preventDefault(){},target:this});}
    matches(selector){return selector.startsWith('.')?this.classList.contains(selector.slice(1)):this.tagName===selector.toUpperCase();}
    querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    showModal(){this.open=true;} close(){this.open=false;for(const fn of this.listeners.get('close')||[])fn({});}
  }
  class OrderedList extends Element{constructor(){super('ol');}}
  const document={body:new Element('body'),hidden:false,createElement:tag=>tag==='ol'?new OrderedList():new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),createTextNode:text=>{const n=new Element('#text');n.textContent=text;return n;}};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const window={location:{href:'https://nexowatt/smarthome/',assign:url=>navigations.push(url)},open:(...args)=>navigations.push(args),dispatchEvent:e=>events.push(e),NW_SH_FEEDBACK:{post:async(...args)=>{posts.push(args);return {ok:true};},attachStatus(){}}};
  const context={window,document,Date:Clock,Intl,URL,URLSearchParams,TextDecoder,TextEncoder,AbortController,Response,Uint8Array,console,HTMLElement:Element,HTMLOListElement:OrderedList,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),fetch:async(...args)=>{requests.push(args);return fetcher?fetcher(...args):new Response(JSON.stringify({ok:true,points:[{ts:now-3600000,value:0},{ts:now,value:10}]}));}};
  context.globalThis=context;vm.createContext(context);vm.runInContext(parser,context);vm.runInContext(source,context,{filename});
  const mount=()=>{const root=new Element();document.body.append(root);return root;};
  return {api:window.NW_SH_CUSTOM_VIEWS,window,document,mount,timers,posts,requests,navigations,events,advance(ms=1000){now+=ms;const tasks=[...timers.values()];timers.clear();for(const t of tasks)t.fn();},button(root,label){const b=root.querySelectorAll('button').find(n=>n.textContent===label);assert.ok(b,`Missing ${label}`);return b;}};
}
const field=(key,value,extra={})=>({key,label:key,value,valid:value!==null,readable:true,writable:false,type:typeof value,unit:'',...extra});
const device=(kind,fields=[],settings={},extra={})=>({id:'device-1',name:'Test <img>',customView:{kind,settings},deviceControls:{profile:'custom_'+kind,fields},...extra});
const flush=async()=>{for(let i=0;i<14;i++)await new Promise(resolve=>setImmediate(resolve));};
test('all ten built-ins render without network or device commands; no values fabricated',()=>{
 const f=fixture();const types=['clock','gauge','wind','presence','markdown','iframe','universal','energyFlow','weather','newline'];
 for(const kind of types){const root=f.mount();const before=JSON.stringify(device(kind));const handle=f.api.render(root,device(kind));assert.ok(handle,kind);assert.equal(JSON.stringify(device(kind)),before);assert.ok(root.querySelector('.nw-sh-custom-view'));if(kind==='gauge')assert.match(root.textContent,/noch nicht zugeordnet/);if(kind==='presence')assert.match(root.textContent,/Keine Rückmeldung/);handle.destroy();assert.equal(root.children.length,0);}
 assert.equal(f.requests.length,0);assert.equal(f.posts.length,0);assert.equal(f.timers.size,0);
});
test('gauge bounds, real zero, pending acknowledgement and secondary values are distinct',()=>{
 const f=fixture();const root=f.mount();const handle=f.api.render(root,device('gauge',[field('VALUE',0,{min:0,max:100}),field('SECOND',50,{min:0,max:100})],{minValue:0,maxValue:100,colorLevels:[{value:0,color:'#123456'}]}));
 assert.equal(root.querySelectorAll('.nw-sh-cv-gauge-ring')[0].style.properties['--nw-cv-progress'],'0%');assert.match(root.textContent,/50/);
 handle.update(device('gauge',[field('VALUE',90,{min:0,max:100,ack:false})]));assert.match(root.textContent,/Nicht bestätigt/);assert.equal(root.querySelector('.nw-sh-cv-gauge-ring').dataset.known,'false');
 handle.update(device('gauge',[field('VALUE',null,{type:'number',min:0,max:100})]));assert.match(root.textContent,/—/);assert.equal(root.querySelector('.nw-sh-cv-gauge-ring').dataset.known,'false');
});
test('clock shares one timer, renders analog/timezone/solar and clears detached views',()=>{
 const f=fixture();const first=f.mount(),second=f.mount();f.api.render(first,device('clock',[],{style:'analog',timeZone:'Europe/Berlin',showSun:true,latitude:52.52,longitude:13.405}));f.api.render(second,device('clock',[],{}));assert.equal(f.timers.size,1);assert.ok(first.querySelector('svg'));assert.match(first.textContent,/ca\./);first.remove();second.remove();f.advance();assert.equal(f.timers.size,0);
 const polar=f.mount();f.api.render(polar,device('clock',[],{showSun:true,latitude:89,longitude:0}));assert.match(polar.textContent,/Kein Sonnenauf/);f.api.destroy(polar);assert.equal(f.timers.size,0);
});
test('wind, presence and local forecast use acknowledged actual readings without external resources',()=>{
 const f=fixture();const wind=f.mount();f.api.render(wind,device('wind',[field('WIND_DIRECTION',90),field('WIND_SPEED',0),field('WIND_GUST',null,{type:'number'})]));assert.equal(wind.querySelector('.nw-sh-cv-compass-arrow').style.transform,'rotate(90deg)');assert.match(wind.textContent,/—/);
 const presence=f.mount();const h=f.api.render(presence,device('presence',[field('PRESENCE',false)],{absentMode:'hide'}));assert.equal(presence.querySelector('.nw-sh-custom-view').dataset.hideWhenAbsent,'true');h.update(device('presence',[field('PRESENCE',false)],{invert:true}));assert.match(presence.textContent,/Anwesend/);
 const weather=f.mount();const fields=[];for(let i=1;i<=7;i++)fields.push(field('TEMP_MIN'+i,i),field('TEMP_MAX'+i,i+10),field('DOW'+i,'Tag '+i));fields.push(field('ACTUAL',99,{ack:false}));f.api.renderForecast(weather,{id:'weather',deviceControls:{fields}});assert.equal(weather.querySelectorAll('.nw-sh-cv-forecast-day').length,7);assert.match(weather.textContent,/Nicht bestätigt/);assert.doesNotMatch(weather.textContent,/99/);assert.equal(f.requests.length,0);
});
test('GFM parser supports tables, tasks, deletion, code and references while raw HTML and unsafe URLs are inert',()=>{
 const f=fixture();const root=f.mount();f.api.render(root,device('markdown',[],{text:'# Titel\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] fertig\n\n~~alt~~ `code`\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1)) [good][ref]\n\n[ref]: https://nexowatt/help\n\n![bad](data:text/html,x)'}));
 assert.equal(root.querySelectorAll('table').length,1);assert.ok(root.querySelector('del'));assert.ok(root.querySelector('code'));assert.equal(root.querySelector('input').checked,true);assert.equal(root.querySelector('input').disabled,true);assert.equal(root.querySelector('script'),null);assert.equal(root.querySelector('img'),null);const links=root.querySelectorAll('a');assert.equal(links.find(a=>a.textContent==='unsafe').href,undefined);assert.equal(links.find(a=>a.textContent==='good').rel,'noopener noreferrer');assert.equal(f.requests.length,0);
});
test('iframe URL policy, sandbox, idempotent update and detached dialog cleanup',()=>{
 const f=fixture();for(const url of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.test','https://example.test/\n']){const root=f.mount();f.api.render(root,device('iframe',[],{url}));assert.equal(root.querySelector('iframe'),null);}
 const root=f.mount();const d=device('iframe',[],{url:'/safe',refreshInterval:10,appendTimestamp:true});const h=f.api.render(root,d);const frame=root.querySelector('iframe');assert.equal(frame.getAttribute('sandbox'),'allow-scripts allow-forms allow-popups');assert.match(frame.src,/https:\/\/nexowatt\/safe/);h.update(d);assert.equal(root.querySelector('iframe'),frame);f.button(root,'Ansicht öffnen').click();assert.equal(f.document.body.querySelectorAll('dialog').length,1);root.remove();f.advance();assert.equal(f.document.body.querySelectorAll('dialog').length,0);assert.equal(f.timers.size,0);
});
test('universal actions obey write metadata, explicit confirmation and acknowledgement; no optimistic hardware state',async()=>{
 const f=fixture();const root=f.mount();f.api.render(root,device('universal',[field('ACTION',false,{writable:true,confirm:true})],{actionType:'toggle'}));f.button(root,'Aktion ausführen').click();assert.equal(f.posts.length,0);f.button(root,'Bestätigen').click();await flush();assert.equal(f.posts.length,1);assert.deepEqual(JSON.parse(JSON.stringify(f.posts[0][1])),{id:'device-1',key:'ACTION',value:true,confirmed:true});assert.equal(f.events[0].type,'nw-smarthome-refresh');
 for(const action of [field('ACTION',false,{writable:false}),field('ACTION',null,{type:'boolean',writable:true}),field('ACTION',false,{writable:true,ack:false})]){const box=f.mount();f.api.render(box,device('universal',[action],{actionType:'toggle'}));assert.equal(f.button(box,'Aktion ausführen').disabled,true);}
 const invalid=f.mount();f.api.render(invalid,device('universal',[field('ACTION',0,{writable:true,min:0,max:10,step:2})],{actionValue:3}));assert.equal(f.button(invalid,'Aktion ausführen').disabled,true);
});
test('energy indices and unavailable fields remain exact; known zero means idle',()=>{
 const f=fixture();const root=f.mount();f.api.render(root,device('energyFlow',[field('PRODUCER7',0,{unit:'W'}),field('PRODUCER7_TODAY',3,{unit:'kWh'}),field('CONSUMER2',null,{type:'number'}),field('BATTERY_SOC',50,{unit:'%'})],{producers:[{index:7,name:'PV'}],consumers:[{index:2,name:'Haus'}]}));assert.equal(root.querySelectorAll('.nw-sh-cv-energy-item')[0].dataset.direction,'idle');assert.equal(root.querySelectorAll('.nw-sh-cv-energy-item')[1].dataset.direction,'unknown');assert.match(root.textContent,/0 W/);assert.match(root.textContent,/3 kWh/);assert.match(root.textContent,/50 %/);
});
test('history requests only after explicit period click, uses mapped key, renders bounded data and releases view',async()=>{
 const f=fixture();const root=f.mount();const h=f.api.renderHistory(root,{id:'safe-device',deviceControls:{fields:[field('ACTUAL',10)]}},'ACTUAL');assert.equal(f.requests.length,0);f.button(root,'24 Stunden').click();await flush();assert.equal(f.requests.length,1);const u=new URL(f.requests[0][0],'https://nexowatt');assert.equal(u.pathname,'/api/smarthome/control-history');assert.equal(u.searchParams.get('id'),'safe-device');assert.equal(u.searchParams.get('key'),'ACTUAL');assert.equal(u.searchParams.has('dp'),false);assert.match(root.textContent,/Minimum 0/);assert.ok(root.querySelector('polyline'));assert.equal(f.timers.size,0);h.destroy();assert.equal(root.children.length,0);
});
test('history abort, oversize cancellation and malformed points fail locally without unhandled rejection',async()=>{
 const f=fixture(()=>new Promise(()=>{}));const root=f.mount();const h=f.api.renderHistory(root,{id:'x',deviceControls:{fields:[field('VALUE',0)]}},'VALUE');f.button(root,'7 Tage').click();f.advance(6000);await flush();assert.match(root.textContent,/abgebrochen/);h.destroy();assert.equal(f.timers.size,0);
 let cancelled=false;const big=fixture(()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(512*1024+1));},cancel(){cancelled=true;}})));const b=big.mount();big.api.renderHistory(b,{id:'x',deviceControls:{fields:[field('VALUE',0)]}},'VALUE');big.button(b,'24 Stunden').click();await flush();assert.equal(cancelled,true);assert.match(b.textContent,/nicht verfügbar/);
 const bad=fixture(()=>new Response(JSON.stringify({ok:true,points:[{ts:0,value:99},{ts:Date.now(),value:'<script>'}]})));const c=bad.mount();bad.api.renderHistory(c,{id:'x',deviceControls:{fields:[field('VALUE',0)]}},'VALUE');bad.button(c,'24 Stunden').click();await flush();assert.match(c.textContent,/Keine Verlaufsdaten/);assert.equal(c.querySelector('svg'),null);
});

test('reference upper thresholds, percentage color mode, gradients and unit overrides retain measurement semantics',()=>{
 const f=fixture(),root=f.mount();const base={minValue:0,maxValue:200,gaugeUnit:'kW',usePercentage:true,colorLevels:[{value:25,color:'#ff0000'},{value:75,color:'#00ff00'},{value:100,color:'#0000ff'}]};const h=f.api.render(root,device('gauge',[field('VALUE',80,{unit:'W'})],base));assert.match(root.textContent,/80 kW/);assert.doesNotMatch(root.querySelector('.nw-sh-cv-gauge-ring').textContent,/%/);assert.equal(root.querySelector('.nw-sh-cv-gauge-ring').style.properties['--nw-cv-color'],'#00ff00');h.update(device('gauge',[field('VALUE',100)],{...base,smoothGradient:true,colorLevels:[{value:0,color:'#000000'},{value:100,color:'#ffffff'}]}));assert.equal(root.querySelector('.nw-sh-cv-gauge-ring').style.properties['--nw-cv-color'],'#808080');
});
test('custom weather preserves pending fields/settings, wind accepts named bearings and paint resets stale styles',()=>{
 const f=fixture(),root=f.mount();const h=f.api.render(root,device('weather',[field('ACTUAL',99,{ack:false}),field('TEMP_MIN1',1),field('TEMP_MIN2',2)],{cityName:'Rhede',forecastDays:1}));assert.match(root.textContent,/Rhede/);assert.match(root.textContent,/Nicht bestätigt/);assert.doesNotMatch(root.textContent,/99/);assert.equal(root.querySelectorAll('.nw-sh-cv-forecast-day').length,1);
 h.update(device('wind',[field('WIND_DIRECTION','NW')]));assert.equal(root.querySelector('.nw-sh-cv-compass-arrow').style.transform,'rotate(315deg)');
 h.update(device('universal',[field('VALUE',1.23456),field('SECOND',2),field('OPACITY',0,{min:0,max:100})],{digits:3,secondaryName:'Zusatz'}));assert.equal(root.querySelector('.nw-sh-custom-view').style.opacity,'0');assert.match(root.textContent,/1,235/);assert.match(root.textContent,/Zusatz/);h.update(device('clock',[],{}));assert.equal(root.querySelector('.nw-sh-custom-view').style.opacity,'');
});
test('explicit confirmation reports interaction so parent polling cannot discard dialog; hide mode preserves unknown',()=>{
 const f=fixture(),root=f.mount();const h=f.api.render(root,device('universal',[field('ACTION',false,{writable:true,confirm:true})],{actionType:'toggle'}));assert.equal(f.api.isInteracting(root),false);f.button(root,'Aktion ausführen').click();assert.equal(f.api.isInteracting(root),true);f.button(root,'Abbrechen').click();assert.equal(f.api.isInteracting(root),false);
 h.update(device('presence',[field('PRESENCE',false)],{absentMode:'hide'}));assert.equal(root.hidden,true);h.update(device('presence',[field('PRESENCE',null,{type:'boolean'})],{absentMode:'hide'}));assert.equal(root.hidden,false);
});

test('history line/step and smoothing are local transformations; zoom sends only a new bounded mapped query',async()=>{
 const f=fixture(),root=f.mount();f.api.renderHistory(root,{id:'sensor',deviceControls:{fields:[field('VALUE',1)]}},'VALUE');f.button(root,'1 Stunde').click();await flush();const poly=root.querySelector('polyline').getAttribute('points');const controls=root.querySelectorAll('select');controls[0].value='step-end';for(const handler of controls[0].listeners.get('change'))handler();assert.ok(root.querySelector('polyline').getAttribute('points').length>poly.length);assert.equal(f.requests.length,1);controls[1].value='30';for(const handler of controls[1].listeners.get('change'))handler();assert.match(root.textContent,/geglättete Anzeige/);assert.equal(f.requests.length,1);f.button(root,'Vergrößern').click();await flush();assert.equal(f.requests.length,2);const q=new URL(f.requests[1][0],'https://nexowatt').searchParams;assert.equal(Number(q.get('to'))-Number(q.get('from')),1800000);
});
test('history revokes old view data and controls when mapping permission is removed',async()=>{
 const f=fixture(),root=f.mount();const h=f.api.renderHistory(root,{id:'sensor',deviceControls:{fields:[field('VALUE',1)]}},'VALUE');f.button(root,'24 Stunden').click();await flush();assert.ok(root.querySelector('svg'));h.update({id:'sensor',deviceControls:{fields:[field('VALUE',1,{readable:false})]}});assert.equal(root.querySelector('svg'),null);assert.match(root.textContent,/nicht freigegeben/);assert.equal(f.button(root,'24 Stunden').disabled,true);f.button(root,'24 Stunden').click();assert.equal(f.requests.length,1);
});
test('global interaction check includes confirmation in any custom tile',()=>{
 const f=fixture(),first=f.mount(),second=f.mount();f.api.render(first,device('clock'));f.api.render(second,device('universal',[field('ACTION',false,{writable:true,confirm:true})],{actionType:'toggle'}));assert.equal(f.api.isInteracting(),false);f.button(second,'Aktion ausführen').click();assert.equal(f.api.isInteracting(),true);f.button(second,'Abbrechen').click();assert.equal(f.api.isInteracting(),false);
});
