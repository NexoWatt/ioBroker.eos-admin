'use strict';
const root='/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin';
const {DeviceRuntime}=require(root+'/modules/devices/lib/deviceRuntime');
const {ModbusDriver}=require(root+'/modules/devices/lib/drivers/modbus');
const t=require(root+'/modules/devices/lib/templates.json').templates.find(t=>t.id==='ess.solax.SolaXHybridX1X3Ess');
(async()=>{
 const states=new Map();const requests=[];
 const a={namespace:'eos-admin.0',log:{info(){},warn(){},error(){},debug(){}},setObjectNotExistsAsync:async()=>{},extendObjectAsync:async()=>{},getStateAsync:async()=>null,setStateAsync:async(id,v)=>states.set(id,v)};
 const cfg={id:'s',templateId:t.id,protocol:'modbusTcp',connection:{host:'127.0.0.1',port:502,unitId:1,isolateReadDatapoints:true}};
 const rt=new DeviceRuntime(a,cfg,t,{});await rt.initObjects();const d=new ModbusDriver(a,cfg,t,{});rt.driver=d;
 d.ensureConnected=async()=>{};
 d._readRegisterWords=async(fc,addr,len)=>{requests.push({fc,addr,len});return addr===416?[4]:addr===417?[1,500]:Array(len).fill(0);};
 const dp=t.datapoints.filter(d=>['sET_CONTROL_MODE','sET_ACTIVE_POWER','vPP_WAIT_TIMEOUT','vPP_NEXT_MOTION'].includes(d.id));
 const values=await d.readDatapoints(dp);await rt._updateAliases(values,{connected:true});console.log(JSON.stringify({node:process.version,requests,values,readback:states.get('devices.s.aliases.v1.r.powerSetpointReadbackW')}));
 await rt.stop();
})().catch(e=>{console.error(e);process.exitCode=1});
