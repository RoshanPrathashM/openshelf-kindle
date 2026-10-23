/* OpenShelf progressive tool drawer: utility sections stay hidden until requested. */
(function(){
  function init(){
    var candidates=[].slice.call(document.querySelectorAll('section'));
    var tools=candidates.filter(function(s){
      var t=(s.textContent||'').toLowerCase();
      return t.indexOf('translation')>=0||t.indexOf('notes')>=0||t.indexOf('reading tools')>=0||t.indexOf('ai assistant')>=0||t.indexOf('send to kindle')>=0;
    });
    tools.forEach(function(s){s.classList.add('os-tool-hidden');});
    var button=document.createElement('button');button.className='os-tools-button';button.type='button';button.textContent='⚙ Tools';button.setAttribute('aria-expanded','false');
    var panel=document.createElement('div');panel.className='os-tools-panel';panel.setAttribute('aria-hidden','true');
    panel.innerHTML='<h3>Reading tools</h3><p style="margin:0;color:#68736d;font-size:.84rem">Keep the library clean. Open a tool only when you need it.</p>';
    tools.forEach(function(section,index){
      var title=(section.querySelector('h2,h3')||{}).textContent||('Tool '+(index+1));
      var b=document.createElement('button');b.type='button';b.textContent=title.trim();b.onclick=function(){
        tools.forEach(function(s){s.classList.add('os-tool-hidden');});
        section.classList.remove('os-tool-hidden');
        panel.classList.remove('open');panel.setAttribute('aria-hidden','true');button.setAttribute('aria-expanded','false');
        section.scrollIntoView({behavior:'smooth',block:'start'});
      };panel.appendChild(b);
    });
    var close=document.createElement('button');close.type='button';close.className='os-close';close.textContent='Close tools';close.onclick=function(){tools.forEach(function(s){s.classList.add('os-tool-hidden');});panel.classList.remove('open');panel.setAttribute('aria-hidden','true');button.setAttribute('aria-expanded','false');};panel.appendChild(close);
    button.onclick=function(){var open=!panel.classList.contains('open');panel.classList.toggle('open',open);panel.setAttribute('aria-hidden',String(!open));button.setAttribute('aria-expanded',String(open));};
    document.body.appendChild(button);document.body.appendChild(panel);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
