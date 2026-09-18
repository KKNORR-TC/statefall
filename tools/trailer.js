'use strict';

const {command,frame,parseArgs,run,startMatch}=require('./trailer-capture.js');

const HELP=`Usage: node tools/trailer.js [seed] [country] [--frames N] [--smoke]

Captures deterministic JPEG frames from the real built Statefall Canvas.
Output: OUT (default /tmp/trailer)/f00000.jpg, f00001.jpg, ...

Options:
  --frames N  Capture N frames (default 210)
  --smoke     Capture one frame quickly
  --help      Show this help

Run "npm run build:trailer" first. This tool emits a frame sequence; it does
not assemble GIF or video because the project has no lightweight encoder.
`;

async function main(){
  const {options,positional}=parseArgs(process.argv.slice(2),210);
  if(options.help){process.stdout.write(HELP);return;}
  const seed=positional[0]||'TRAILER',country=positional[1]||'Norway';
  if(positional.length>2)throw new Error('Too many positional arguments. See --help.');
  const output=process.env.OUT||'/tmp/trailer';
  const count=await run(output,async capture=>{
    await startMatch(capture,{seed,country,difficulty:'hard'});
    let fixture=false;
    for(let i=0;i<options.frames;i++){
      if(i>0)await command(capture,'advance',options.smoke?1:8);
      const phase=i/Math.max(1,options.frames-1);
      if(!fixture&&phase>=0.62){await command(capture,'installLateGameScene');fixture=true;}
      const scale=phase<0.2?7:phase<0.4?4.2:phase<0.62?2.6:phase<0.86?5:0.9;
      if(!fixture||phase>=0.86)await command(capture,'setCamera',scale,phase>=0.86?'world':'player');
      await frame(capture);
    }
  });
  process.stdout.write(`frames ${count} output ${output}\n`);
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
