export const HELP_TABS=Object.freeze([['basics','Basics'],['build','Buildings'],['ships','Ships'],['air','Air'],['systems','Systems'],['garrisons','Garrisons'],['modes','Modes'],['about','About']]);
export const HELP_SOURCE_ROOT=new URL('./help-pages/',import.meta.url);
export const HELP_SOURCE_FILES=Object.freeze(['tabs.json',...HELP_TABS.flatMap(([key])=>[`${key}.html`,`${key}/index.html`])]);
