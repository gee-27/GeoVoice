// Native disclosures keep secondary controls available to touch and keyboard users.
export function installCompactLayout(main, live=false){
 const expanded=new Map();
 function fold(node,label,key){
  if(!node||node.closest('details.compact-panel'))return;
  const details=document.createElement('details');details.className='compact-panel';
  const summary=document.createElement('summary');summary.textContent=label;
  details.append(summary);details.open=expanded.get(key)===true;
  node.before(details);details.append(node);
  details.addEventListener('toggle',()=>expanded.set(key,details.open));
 }
 function update(){
  if(live){
   const layout=main.querySelector('.stage')?'game':main.querySelector('.lobby-grid')?'lobby':'setup';
   if(main.dataset.layout!==layout)main.dataset.layout=layout;
   if(main.dataset.layout==='game'){
    fold(main.querySelector('.stage-bottom'),'Standings and team scores','standings');
    fold(main.querySelector('.voice-tools'),'Type or speak an answer','live-input');
   }
   return;
  }
  const view=document.body.dataset.view;
  if(view==='home'){
   fold(main.querySelector('.topic-grid'),'Browse topics with photos','topics');
   const topics=main.querySelector('.topic-grid')?.closest('details');
   if(topics&&topics!==main.lastElementChild)main.append(topics);
   fold(main.querySelector('.grid .camera-card'),'How to play','guide');
   const form=main.querySelector('#quiz-form');
   if(form&&!form.querySelector('.quiz-preferences')){
    const preferences=document.createElement('div');preferences.className='quiz-preferences';
    for(const node of Array.from(form.querySelectorAll('.check,.fine')))preferences.append(node);
    form.append(preferences);fold(preferences,'Microphone options','quiz-preferences');
   }
  }
  if(view==='auth')fold(main.querySelector('.explorer-card'),'About your explorer account','about');
  if(view==='settings')fold(main.querySelector('.grid > section:nth-child(2)'),'Camera, microphone and privacy','privacy');
  if(view==='quiz'){
   fold(main.querySelector('#typed-form'),'Type an answer','typed');
   const voice=main.querySelector('.voice-panel');
   if(voice&&!voice.querySelector('.voice-settings')){
    const settings=document.createElement('div');settings.className='voice-settings';
    for(const selector of ['#pause','label[for="speech-language"]','#speech-language','.fine']){
     const node=voice.querySelector(selector);if(node)settings.append(node);
    }
    voice.append(settings);fold(settings,'Voice settings','voice');
   }
  }
 }
 const observer=new window.MutationObserver(()=>{observer.disconnect();try{update();}finally{observer.observe(main,{childList:true});}});
 observer.observe(main,{childList:true});update();
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
