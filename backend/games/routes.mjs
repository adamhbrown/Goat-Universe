import {readFile} from 'node:fs/promises';

const gameKeys=new Set(['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic']);
const assets=new Map(['boot.mjs','ui.mjs','nfl.mjs','series.mjs','fantasy.mjs','annual.mjs','style.css'].map(file=>['/games/'+file,file]));
export async function competitionAsset(pathname){
 let file=assets.get(pathname);
 if(pathname==='/games'||pathname==='/games/'||pathname.startsWith('/games/')&&gameKeys.has(pathname.split('/')[2])&&pathname.split('/').length===3)file='index.html';
 if(['/portal/bracket.mjs','/portal/forms.mjs'].includes(pathname))return {content:await readFile(new URL('../portal/'+pathname.split('/').at(-1),import.meta.url)),type:'text/javascript'};
 if(['/games/rules.mjs','/rules/goat-games.mjs'].includes(pathname))return {content:await readFile(new URL('../rules/goat-games.mjs',import.meta.url)),type:'text/javascript'};
 if(!file)return null;
 return {content:await readFile(new URL(file,import.meta.url)),type:file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'};
}
