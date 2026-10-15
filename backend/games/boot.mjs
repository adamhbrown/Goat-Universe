import {client} from '/manage/forms.mjs';
import {mountGames} from './ui.mjs';

mountGames({document,location,history,createClient:()=>client(),fetchPublic:fetch}).catch(()=>{
 document.querySelector('#notice').textContent='The competition workspace is unavailable. Please try again later.';
});
