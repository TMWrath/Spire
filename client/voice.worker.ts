import {env,pipeline} from '@huggingface/transformers';
// Model and WASM bytes are served by Spire. Audio never leaves this worker/device.
env.allowRemoteModels=false;
env.allowLocalModels=true;
env.localModelPath='/voice/models/';
env.useBrowserCache=true;
if(env.backends.onnx.wasm){env.backends.onnx.wasm.wasmPaths='/voice/wasm/';env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;}
let recognizer:ReturnType<typeof pipeline>|null=null;
self.onmessage=async(event:MessageEvent<{samples:Float32Array}>)=>{
 try{
  self.postMessage({status:'Loading on-device speech model…'});
  recognizer??=pipeline('automatic-speech-recognition','whisper-tiny.en',{device:'wasm',dtype:'q8'});
  const asr=await recognizer;
  self.postMessage({status:'Transcribing on this device…'});
  const result=await (asr as any)(event.data.samples,{chunk_length_s:30,stride_length_s:5,return_timestamps:true});
  self.postMessage({result});
 }catch(error){recognizer=null;self.postMessage({error:error instanceof Error?error.message:'On-device transcription failed.'});}
};
