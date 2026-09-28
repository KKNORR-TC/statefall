// Presentation runs at a nominal 60 steps/second, independent of display refresh rate.
export function createPresentationStepClock(){
  let previous=null,remainder=0;
  const reset=()=>{previous=null;remainder=0;};
  return {
    reset,
    steps(now,enabled=true){
      if(!enabled){reset();return 1;}
      if(!Number.isFinite(now))throw new TypeError('Invalid presentation time');
      if(previous===null||now<previous){previous=now;remainder=0;return 1;}
      remainder+=Math.min(250,now-previous)*.06;previous=now;
      const steps=Math.floor(remainder+1e-9);remainder=Math.max(0,remainder-steps);
      return steps;
    }
  };
}
