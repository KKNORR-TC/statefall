import {GAME_VERSION,GAME_BUILD} from './config/build.js';

// Update this player-facing note with every game release. The package build
// deliberately fails when it no longer matches the release metadata.
export const HELP_RELEASE={
 version:'1.10.63',
 build:'2026-10-01-guided-first-match',
 title:'Learn your first moves. Set up your next match.',
 changes:[
  'Learn to play guides you through the real battlefield: camera controls, troops and gold, construction, attacking and capturing territory. Practice does not save matches or post scores.',
  'New match walks through mode, map and difficulty, country and a final review. Random match includes a Ready card and Shuffle.',
  'The opening menu provides tutorial introductions, games and replays, and a Game guide with a route back to setup.',
  'Restart preserves the active match settings, country, custom opponents and allowed units.'
 ]
};
export function assertHelpRelease(version=GAME_VERSION,build=GAME_BUILD){
 if(HELP_RELEASE.version!==version||HELP_RELEASE.build!==build||!HELP_RELEASE.changes.length)throw new Error('Update the About release note before building this release.');
}
