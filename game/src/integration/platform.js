import {createLocalPlatform} from './local-platform.js';
import {createWordPressPlatform} from './wordpress-platform.js';

function wordpressConfig(){
  if(typeof window==='undefined') return null;
  if(window.STATEFALL_WP) return window.STATEFALL_WP;
  const element=document.getElementById('statefall-wp-config');
  if(!element) return null;
  try{return JSON.parse(element.textContent);}catch(error){console.error('[statefall] invalid WordPress configuration',error);return null;}
}

export function createPlatform({training=false}={}){
  const config=training?null:wordpressConfig();
  return config?createWordPressPlatform(config):createLocalPlatform();
}
