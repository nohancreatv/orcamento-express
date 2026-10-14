import assert from 'node:assert/strict';
import {encodeWorkspace,decodeWorkspace,nextRevision} from '../src/firebase-workspace.mjs';
const data={schema:2,draft:{title:'Meu orçamento'},versions:[]};
assert.deepEqual(decodeWorkspace(encodeWorkspace(data)),data);
assert.equal(nextRevision(0,0),1);
assert.throws(()=>nextRevision(2,1),e=>e.status===409);
assert.throws(()=>encodeWorkspace({...data,versions:Array(101).fill({})}),e=>e.status===422);
assert.throws(()=>encodeWorkspace({...data,draft:{logo:'a'.repeat(900000)}}),e=>e.status===422);
console.log('Firebase payload size, schema and revision checks passed.');
