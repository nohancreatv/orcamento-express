import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,serverTimestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-orcamento-express',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync('firestore.rules','utf8')}});
const valid=revision=>({payload:'{"schema":2,"draft":{},"versions":[]}',revision,updatedAt:serverTimestamp()});
try{
 await env.clearFirestore();
 const a=env.authenticatedContext('alice',{email_verified:true,firebase:{sign_in_provider:'password'}}).firestore();
 const b=env.authenticatedContext('bob',{email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
 const anon=env.unauthenticatedContext().firestore();
 const unverified=env.authenticatedContext('unverified',{email_verified:false,firebase:{sign_in_provider:'password'}}).firestore();
 await assertSucceeds(setDoc(doc(a,'workspaces/alice'),valid(1)));
 await assertSucceeds(getDoc(doc(a,'workspaces/alice')));
 await assertFails(getDoc(doc(b,'workspaces/alice')));
 await assertFails(getDoc(doc(anon,'workspaces/alice')));
 await assertFails(setDoc(doc(b,'workspaces/alice'),valid(2)));
 await assertFails(setDoc(doc(unverified,'workspaces/unverified'),valid(1)));
 await assertFails(setDoc(doc(a,'workspaces/alice'),valid(1)));
 await assertSucceeds(setDoc(doc(a,'workspaces/alice'),valid(2)));
 await assertFails(setDoc(doc(a,'workspaces/alice'),{...valid(3),payload:'a'.repeat(900001)}));
 await assertFails(setDoc(doc(a,'workspaces/alice'),{...valid(3),extra:'forbidden'}));
 await assertFails(getDocs(collection(a,'workspaces')));
 for(const provider of ['google.com','microsoft.com','facebook.com','github.com']){
   const social=env.authenticatedContext(provider,{firebase:{sign_in_provider:provider}}).firestore();
   await assertSucceeds(setDoc(doc(social,'workspaces',provider),valid(1)));
 }
 console.log('Firestore rules passed: owner isolation, anonymous denial, verification, all social providers, revision, size and field constraints.');
}finally{await env.cleanup();}
