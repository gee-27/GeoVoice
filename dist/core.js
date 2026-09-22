export function normalize(text) {return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
export function resolveAnswer(transcript, options) {
  let clean=normalize(transcript);
  if(/\b(not|no|never|maybe|or|instead|sorry)\b/.test(clean))return null;
  clean=clean.replace(/^(?:(?:my |the )?answer is|i choose|i think it is|i think|it is|it s|its) /,'');
  clean=clean.replace(/^(?:(?:option|answer|letter|number) )+/,'').replace(/^the /,'').replace(/ please$/,'').trim();
  const letters={a:0,ay:0,b:1,bee:1,be:1,c:2,see:2,sea:2,d:3,dee:3,one:0,two:1,three:2,four:3,'1':0,'2':1,'3':2,'4':3};
  const canonical=t=>normalize(t).replace(/^the /,'').replace(/^mt /,'mount ').replace(/\s/g,'');
  const matches=options.map((o,i)=>canonical(o)===canonical(clean)?i:-1).filter(i=>i>=0);
  if(matches.length)return matches.length===1?matches[0]:null;
  if(Object.hasOwn(letters,clean)&&letters[clean]<options.length)return letters[clean];
  // A spoken letter followed by a name must agree with that name.
  const combined=clean.match(/^(a|ay|b|bee|be|c|see|sea|d|dee) (.+)$/);
  if(combined){const index=letters[combined[1]];if(options[index]&&canonical(options[index])===canonical(combined[2]))return index;}
  return null;
}
export function shuffle(items, random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function buildQuiz(bank, category='All',count=10,random=Math.random){
  return shuffle(bank.filter(q=>category==='All'||q.category===category),random).slice(0,count).map(q=>{const options=shuffle(q.options,random);return {...q,options,answer:options.indexOf(q.options[q.answer])};});
}
export function distance(a,b){if(!a||!b||a.length!==128||b.length!==128||![...a,...b].every(Number.isFinite))return Infinity;return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));}
export function matchesFace(samples, known, threshold=.48){return samples.length>=2&&known.length>=3&&samples.every(sample=>known.filter(ref=>distance(sample,ref)<threshold).length>=2);}
export function score(answers){const correct=answers.filter(a=>a.selected===a.question.answer).length;return {correct,total:answers.length,percent:answers.length?Math.round(correct/answers.length*100):0};}
