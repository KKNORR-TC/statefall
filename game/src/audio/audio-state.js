import {readJson,writeJson} from '../utils/storage.js';

const defaults={master:0.7,sfx:0.8,alert:0.8,amb:0.25,music:0.4,mute:false,ambOn:true,musicOn:true};

export function createAudioState(storage=localStorage){
  const vol={...defaults};
  const saved=readJson(storage,'statefall-audio',null);
  if(saved) for(const key of ['master','sfx','alert','amb','music']) if(typeof saved[key]==='number') vol[key]=saved[key];
  return {ctx:null,bus:{},vol,last:{}};
}

export function saveAudioLevels(storage,vol){
  writeJson(storage,'statefall-audio',{master:vol.master,sfx:vol.sfx,alert:vol.alert,amb:vol.amb,music:vol.music});
}
