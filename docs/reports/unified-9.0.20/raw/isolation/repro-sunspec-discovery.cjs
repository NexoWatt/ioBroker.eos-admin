'use strict';
const { ModbusDriver } = require(process.env.EOS_REVIEW_MODBUS || '/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin/modules/devices/lib/drivers/modbus.js');
(async()=>{
const d=new ModbusDriver({log:{info(){},debug(){},warn(){},error(){}}},{id:'review-sunspec',protocol:'modbusTcp',connection:{host:'127.0.0.1',unitId:1}},{id:'review',datapoints:[]},{});
d._autoSunSpec=true;d._sunSpecDiscovered=false;d._sunSpecScanBases=[40000];d._sunSpecScanFcs=[3];let calls=0;
d._mbReadHoldingRegisters=async()=>{calls++;throw Object.assign(new Error('EOS_DEVICES_NOT_AUTHORIZED'),{code:'EOS_DEVICES_NOT_AUTHORIZED'});};
try{await d._maybeDiscoverSunSpec();}catch(e){console.log('first probe:',e.code);}
console.log('flag after failed discovery:',d._sunSpecDiscovered);
d._mbReadHoldingRegisters=async()=>{calls++;return {data:[0x5375,0x6e53]};};
console.log('retry result:',await d._maybeDiscoverSunSpec(),'total probes:',calls,'confirmed base:',d._sunSpecFoundBase);
})().catch(e=>{console.error(e);process.exitCode=1;});
