/* OpenShelf tool drawer. Only actual utility workspaces are hidden; the book shelves stay visible. */
(function(){
  "use strict";
  function init(){
    var ids=["studio","translate","notes","kindle"];
    var tools=ids.map(function(id){return document.getElementById(id);}).filter(Boolean);
    if(!tools.length)return;

    function closePanel(){
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden","true");
      button.setAttribute("aria-expanded","false");
    }
    function hideTools(){
      tools.forEach(function(section){section.classList.add("os-tool-hidden");});
      document.body.removeAttribute("data-active-tool");
      closePanel();
    }
    function showTool(section){
      tools.forEach(function(item){item.classList.add("os-tool-hidden");});
      section.classList.remove("os-tool-hidden");
      document.body.setAttribute("data-active-tool",section.id);
      closePanel();
      if(location.hash!=="#"+section.id)history.replaceState(null,"",location.pathname+location.search+"#"+section.id);
      section.scrollIntoView({behavior:"smooth",block:"start"});
    }

    tools.forEach(function(section){section.classList.add("os-tool-hidden");});

    var button=document.createElement("button");
    button.className="os-tools-button";
    button.type="button";
    button.textContent="⚙ Tools";
    button.setAttribute("aria-expanded","false");
    button.setAttribute("aria-controls","openshelf-tools-panel");

    var panel=document.createElement("div");
    panel.className="os-tools-panel";
    panel.id="openshelf-tools-panel";
    panel.setAttribute("aria-hidden","true");
    panel.innerHTML='<h3>Reading tools</h3><p class="os-tools-intro">Keep the library clean. Open a tool only when you need it.</p>';

    tools.forEach(function(section){
      var title=(section.querySelector("h2,h3")||{}).textContent||section.id;
      var b=document.createElement("button");
      b.type="button";
      b.textContent=title.trim();
      b.addEventListener("click",function(){showTool(section);});
      panel.appendChild(b);
    });

    var close=document.createElement("button");
    close.type="button";
    close.className="os-close";
    close.textContent="Close tools";
    close.addEventListener("click",function(){
      hideTools();
      if(location.hash && ids.indexOf(location.hash.slice(1))>=0){
        history.replaceState(null,"",location.pathname+location.search);
      }
    });
    panel.appendChild(close);

    button.addEventListener("click",function(){
      var open=!panel.classList.contains("open");
      panel.classList.toggle("open",open);
      panel.setAttribute("aria-hidden",String(!open));
      button.setAttribute("aria-expanded",String(open));
    });
    document.body.appendChild(button);
    document.body.appendChild(panel);

    document.querySelectorAll('.navlinks a[href^="#"]').forEach(function(link){
      link.addEventListener("click",function(){
        var id=(link.getAttribute("href")||"").slice(1);
        var section=tools.find(function(item){return item.id===id;});
        if(section){showTool(section);return;}
        if(id==="library"||id==="read-local"||id==="top"||id===""){
          hideTools();
        }
      });
    });

    window.addEventListener("hashchange",function(){
      var id=(location.hash||"").slice(1);
      var section=tools.find(function(item){return item.id===id;});
      if(section){
        tools.forEach(function(item){item.classList.toggle("os-tool-hidden",item!==section);});
        document.body.setAttribute("data-active-tool",id);
      }else{
        hideTools();
      }
    });
    document.addEventListener("keydown",function(event){
      if(event.key==="Escape"&&panel.classList.contains("open"))closePanel();
    });

    var active=(location.hash||"").slice(1);
    var initial=tools.find(function(item){return item.id===active;});
    if(initial){
      tools.forEach(function(item){item.classList.toggle("os-tool-hidden",item!==initial);});
      document.body.setAttribute("data-active-tool",initial.id);
    }else{
      hideTools();
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();
