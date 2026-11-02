/* The Unposed Story — site behaviour (no dependencies) */
(function(){
  var WA_NUMBER='917045278377';
  var SCRIPT_URL='https://script.google.com/macros/s/AKfycbzd67p90qaIzmWVFP_olrQJs6fzN5JwIgcOrMuDNJIwiaHs6DWKWivNhC0RdK4HVLFt/exec';

  // Header border on scroll
  var hdr=document.querySelector('.hdr');
  function onScroll(){ if(hdr) hdr.classList.toggle('scrolled',window.scrollY>8); }
  window.addEventListener('scroll',onScroll,{passive:true}); onScroll();

  // Mobile menu
  var burger=document.querySelector('.burger');
  if(burger){
    burger.addEventListener('click',function(){
      var open=document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded',open);
    });
    document.querySelectorAll('.drawer a').forEach(function(a){
      a.addEventListener('click',function(){document.body.classList.remove('menu-open');burger.setAttribute('aria-expanded',false);});
    });
  }

  // Portfolio filter
  var tabs=document.querySelectorAll('.tab[data-filter]');
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      var f=t.dataset.filter;
      tabs.forEach(function(x){x.setAttribute('aria-selected',x===t);});
      document.querySelectorAll('.g-item').forEach(function(g){
        g.hidden=!(f==='all'||g.dataset.cat===f);
      });
    });
  });

  // Lightbox
  var items=[].slice.call(document.querySelectorAll('.g-item'));
  if(items.length){
    var lb=document.createElement('div');
    lb.className='lb';lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Photo viewer');
    lb.innerHTML='<button class="x" aria-label="Close">&#10005;</button><button class="pv" aria-label="Previous">&#8592;</button><img alt=""><button class="nx" aria-label="Next">&#8594;</button><p></p>';
    document.body.appendChild(lb);
    var img=lb.querySelector('img'),cap=lb.querySelector('p'),cur=0,last=null;
    function vis(){return items.filter(function(i){return !i.hidden;});}
    function show(i){var v=vis();cur=(i+v.length)%v.length;var el=v[cur],im=el.querySelector('img');
      img.src=im.dataset.full||im.currentSrc||im.src;img.alt=im.alt;cap.textContent=im.alt;}
    function open(el){last=el;show(vis().indexOf(el));lb.classList.add('open');lb.querySelector('.x').focus();}
    function close(){lb.classList.remove('open');if(last)last.focus();}
    items.forEach(function(el){
      el.tabIndex=0;el.setAttribute('role','button');
      el.addEventListener('click',function(){open(el);});
      el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(el);}});
    });
    lb.querySelector('.x').onclick=close;
    lb.querySelector('.pv').onclick=function(){show(cur-1);};
    lb.querySelector('.nx').onclick=function(){show(cur+1);};
    lb.addEventListener('click',function(e){if(e.target===lb)close();});
    document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;
      if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1);});
  }

  // Reviews carousel buttons
  var track=document.querySelector('.rv-track');
  document.querySelectorAll('[data-rv]').forEach(function(b){
    b.addEventListener('click',function(){
      var card=track.querySelector('.rv-card');var step=card?card.getBoundingClientRect().width+18:300;
      track.scrollBy({left:b.dataset.rv==='next'?step:-step,behavior:'smooth'});
    });
  });

  // Reveal on scroll
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.rv-in').forEach(function(el){io.observe(el);});
  } else document.querySelectorAll('.rv-in').forEach(function(el){el.classList.add('on');});

  // Enquiry form: send to Google Sheet, then offer one-tap WhatsApp confirmation
  document.querySelectorAll('form[data-enquiry]').forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!form.reportValidity())return;
      var d={};new FormData(form).forEach(function(v,k){d[k]=String(v).trim();});
      d.source='Website - '+(document.title||'');
      var btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Sending…';
      var msg='Hello Sandip, I would like to check availability with The Unposed Story.%0A'+
        'Name: '+encodeURIComponent(d.name||'')+'%0A'+
        (d.partner?'Partner: '+encodeURIComponent(d.partner)+'%0A':'')+
        'Wedding date: '+encodeURIComponent(d.date||'')+'%0A'+
        'City / venue: '+encodeURIComponent(d.location||'')+
        (d.package?'%0APackage: '+encodeURIComponent(d.package):'');
      var waUrl='https://wa.me/'+WA_NUMBER+'?text='+msg;
      fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(d)})
        .catch(function(){})
        .then(function(){
          form.innerHTML='<div class="form-done"><h3>Thank you, '+(d.name||'').replace(/[<>&"]/g,'')+'.</h3>'+
          '<p>Your enquiry has been sent. For the quickest reply, confirm your date with Sandip on WhatsApp.</p>'+
          '<a class="btn btn-wa" href="'+waUrl+'" target="_blank" rel="noopener">Confirm on WhatsApp</a></div>';
        });
    });
  });
})();
