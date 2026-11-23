'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const https=require('node:https');
const {Readable,Writable,PassThrough}=require('node:stream');
const {http}=require('../build/http');
function pendingUpload(){return new Readable({read(){}});}
function transport(t,behavior){
 let request;
 t.mock.method(https,'request',(_url,options,onResponse)=>{
  assert.equal(options.rejectUnauthorized,true);assert.equal(options.minVersion,'TLSv1.2');
  request=new Writable({write(_chunk,_encoding,callback){callback();}});
  queueMicrotask(()=>behavior(request,onResponse));return request;
 });
 return ()=>request;
}
function response(onResponse,status,body=''){
 const result=new PassThrough();result.statusCode=status;result.headers={};result.complete=true;
 onResponse(result);result.end(body);return result;
}
test('HTTPS connection failure closes a pending upload and request',async t=>{
 const upload=pendingUpload();const req=transport(t,request=>request.emit('error',new Error('private connection detail')));
 await assert.rejects(http(new URL('https://backup.example/upload'),'PUT',{},upload),error=>error.code==='EOS_BACKUP_REMOTE_REQUEST'&&!error.message.includes('private'));
 assert.equal(upload.destroyed,true);assert.equal(req().destroyed,true);
});
test('early HTTPS rejection closes an unfinished upload and request after preserving response status',async t=>{
 const upload=pendingUpload();const req=transport(t,(_request,onResponse)=>response(onResponse,413,'too large'));
 const result=await http(new URL('https://backup.example/upload'),'PUT',{},upload);
 assert.equal(result.status,413);assert.equal(result.body.toString(),'too large');assert.equal(upload.destroyed,true);assert.equal(req().destroyed,true);
});
test('HTTPS response abort and oversized response close pending upload streams',async t=>{
 for(const oversized of [false,true]){
  const upload=pendingUpload();const req=transport(t,(_request,onResponse)=>{
   const res=new PassThrough();res.statusCode=200;res.headers={};res.complete=false;onResponse(res);
   if(oversized)res.write(Buffer.alloc(1024*1024+1));else res.emit('aborted');
  });
  await assert.rejects(http(new URL('https://backup.example/upload'),'PUT',{},upload),/EOS_BACKUP_REMOTE_REQUEST/);
  assert.equal(upload.destroyed,true);assert.equal(req().destroyed,true);t.mock.restoreAll();
 }
});
test('synchronous HTTPS request validation failure closes an upload without exposing values',async t=>{
 const upload=pendingUpload();t.mock.method(https,'request',()=>{throw new Error('private invalid header');});
 await assert.rejects(http(new URL('https://backup.example/upload'),'PUT',{},upload),error=>error.code==='EOS_BACKUP_REMOTE_REQUEST'&&!error.message.includes('private'));
 assert.equal(upload.destroyed,true);
});
test('successful HTTPS response closes the consumed source and keeps a completed request reusable',async t=>{
 const upload=Readable.from(['payload']);const req=transport(t,(request,onResponse)=>{
  if(request.writableFinished)response(onResponse,200,'ok');else request.once('finish',()=>response(onResponse,200,'ok'));
 });
 const result=await http(new URL('https://backup.example/upload'),'PUT',{},upload);
 assert.equal(result.status,200);assert.equal(result.body.toString(),'ok');assert.equal(upload.destroyed,true);assert.equal(req().writableFinished,true);
});
test('HTTPS upload deadline destroys a stalled body and request',async t=>{
 const upload=pendingUpload();const req=transport(t,()=>{});
 // Keep the test process alive while the production deadline intentionally uses unref().
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(http(new URL('https://backup.example/upload'),'PUT',{},upload,10),/EOS_BACKUP_REMOTE_REQUEST/);}
 finally{clearTimeout(keepAlive);}
 assert.equal(upload.destroyed,true);assert.equal(req().destroyed,true);
});
