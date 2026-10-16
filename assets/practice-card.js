/* Portable, inert SVG keepsakes. No upload, external resource, score authority or tracking. */
(function(root){
  'use strict';
  const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  function wrap(value,length){
    const words=String(value).slice(0,240).split(/\s+/),lines=[];let line='';
    words.forEach(word=>{
      if(line&&line.length+word.length+1>length){lines.push(line);line='';}
      while(word.length>length){if(line){lines.push(line);line='';}lines.push(word.slice(0,length));word=word.slice(length);}
      line+=(line?' ':'')+word;
    });if(line)lines.push(line);return lines;
  }
  function text(card){
    return ['GOAT UNIVERSE · WHERE THE GOATS PLAY',card.destination,'FICTIONAL PRACTICE EDITION',card.headline,card.subline,...card.lines,'Local-unverified keepsake. No official result, entry, award, prize, BAAS or GPI.'].filter(Boolean).join('\n');
  }
  function svg(card){
    const title=wrap(card.destination,28).slice(0,2),headline=wrap(card.headline,27).slice(0,2);
    const lines=card.lines.slice(0,8).flatMap(value=>wrap(value,54)).slice(0,11);
    const titleY=210,heroY=titleY+title.length*48+55,rowsY=heroY+headline.length*52+95;
    const height=Math.max(1125,rowsY+lines.length*46+205);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}" role="img" aria-labelledby="title description"><title id="title">${xml(card.destination)} — fictional practice keepsake</title><desc id="description">${xml(text(card))}</desc><defs><radialGradient id="glow"><stop stop-color="#675431" stop-opacity=".45"/><stop offset="1" stop-color="#0d1719" stop-opacity="0"/></radialGradient></defs><rect width="900" height="${height}" fill="#0d1719"/><circle cx="780" cy="220" r="520" fill="url(#glow)"/><rect x="28" y="28" width="844" height="${height-56}" rx="4" fill="none" stroke="#bca56b" stroke-opacity=".6"/><path d="m70 80 18 12 18-12-5 30H75Z" fill="none" stroke="#e5c581" stroke-width="2"/><g font-family="Arial,Helvetica,sans-serif"><text x="128" y="94" fill="#e7d8b4" font-size="24" font-weight="700" letter-spacing="3">GOAT UNIVERSE</text><text x="72" y="148" fill="#aeb8a4" font-size="13" letter-spacing="3">WHERE THE GOATS PLAY.</text><path d="M72 170h756" stroke="#aa955b" stroke-opacity=".45"/>${title.map((line,i)=>`<text x="72" y="${titleY+i*48}" fill="#f2eee4" font-size="38" font-weight="700">${xml(line)}</text>`).join('')}<text x="72" y="${heroY-22}" fill="#c9b982" font-size="13" letter-spacing="3">FICTIONAL PRACTICE EDITION</text>${headline.map((line,i)=>`<text x="72" y="${heroY+38+i*52}" fill="#e5c581" font-size="44" font-weight="700">${xml(line)}</text>`).join('')}<text x="72" y="${rowsY-30}" fill="#bfc8b4" font-size="17">${xml(String(card.subline||'Your call. Your keepsake.').slice(0,74))}</text>${lines.map((line,i)=>`<path d="M72 ${rowsY+i*46}h756" stroke="#a2946033"/><text x="72" y="${rowsY+30+i*46}" fill="#d4dccb" font-size="20">${xml(line)}</text>`).join('')}<path d="M72 ${height-157}h756" stroke="#bca56b" stroke-opacity=".5"/><text x="72" y="${height-120}" fill="#c8ba93" font-size="14" letter-spacing="2">LOCAL-UNVERIFIED KEEPSAKE</text><text x="72" y="${height-91}" fill="#a8b39d" font-size="14">No official result, entry, award, prize, BAAS or GPI.</text><text x="72" y="${height-62}" fill="#e2c583" font-size="14" letter-spacing="2">CAN’T STOP THE BAA.</text></g></svg>`;
  }
  function download(card){
    const blob=new Blob([svg(card)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`GOAT-${String(card.destination).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')}-practice.svg`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  const api=Object.freeze({text,svg,download});root.GoatPracticeCard=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
