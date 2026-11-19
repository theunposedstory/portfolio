/* The Unposed Story — site behaviour (no dependencies) */
(function(){
  var WA_NUMBER='917045278377';
  var WA_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6-.1 1.1Z"/></svg>';
  var SCRIPT_URL='https://script.google.com/macros/s/AKfycbwcZ2FaoubtwXFdrzVU2pZsZ2tQrKcDaGp_2lq2lrAPXDHJ_p7FWQ8pQbX6bgsT-t-jDA/exec';

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

  // Portfolio filter (works for built-in and uploaded photos)
  var gallery=document.querySelector('.gallery'), curFilter='all';
  var tabs=document.querySelectorAll('.tab[data-filter]');
  function applyFilter(f){
    curFilter=f;
    document.querySelectorAll('.g-item').forEach(function(g){g.hidden=!(f==='all'||g.dataset.cat===f);});
  }
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.setAttribute('aria-selected',x===t);});
      applyFilter(t.dataset.filter);
    });
  });

  // Photos uploaded from the private Gallery page (stored in Google Drive)
  var LABEL={wedding:'Weddings',prewedding:'Pre-wedding',haldi:'Haldi',bridal:'Bridal'};
  function driveImg(id,w){return 'https://lh3.googleusercontent.com/d/'+encodeURIComponent(id)+'=w'+w;}
  function escA(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function renderUploads(items){
    if(!gallery||!items)return;
    var only=(gallery.dataset.only||'').split(',').filter(Boolean);   // service pages show their own sections only
    if(only.length)items=items.filter(function(it){return only.indexOf(it.section)>=0;});
    gallery.querySelectorAll('.g-item.up').forEach(function(el){el.remove();});
    var html=items.filter(function(it){return LABEL[it.section]&&it.fileId;}).map(function(it){
      var w=it.w||1200,h=it.h||1500;
      return '<figure class="g-item up" data-cat="'+escA(it.section)+'"><img src="'+driveImg(it.fileId,640)+'" srcset="'+driveImg(it.fileId,640)+' 640w, '+driveImg(it.fileId,1400)+' 1400w" sizes="(max-width:720px) 50vw, 33vw" data-full="'+driveImg(it.fileId,1800)+'" width="'+w+'" height="'+h+'" alt="'+escA(it.alt)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest(\'.g-item\').remove()"><figcaption><small>'+LABEL[it.section]+'</small>'+escA(it.alt)+'</figcaption></figure>';
    }).join('');
    gallery.insertAdjacentHTML('afterbegin',html);
    applyFilter(curFilter);
  }
  if(gallery){
    try{renderUploads(JSON.parse(localStorage.getItem('tus_gal')||'null'));}catch(e){}
    fetch(SCRIPT_URL+'?action=gallery').then(function(r){return r.json();}).then(function(d){
      if(!d||!d.ok)return;
      try{localStorage.setItem('tus_gal',JSON.stringify(d.items));}catch(e){}
      renderUploads(d.items);
    }).catch(function(){});
  }

  // Lightbox (finds photos at open time, so uploaded ones are included)
  if(gallery){
    var lb=document.createElement('div');
    lb.className='lb';lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Photo viewer');
    lb.innerHTML='<button class="x" aria-label="Close">&#10005;</button><button class="pv" aria-label="Previous">&#8592;</button><img alt=""><button class="nx" aria-label="Next">&#8594;</button><p></p>';
    document.body.appendChild(lb);
    var img=lb.querySelector('img'),cap=lb.querySelector('p'),cur=0,last=null;
    function vis(){return [].slice.call(gallery.querySelectorAll('.g-item')).filter(function(i){return !i.hidden;});}
    function show(i){var v=vis();if(!v.length)return;cur=(i+v.length)%v.length;var el=v[cur],im=el.querySelector('img');
      img.referrerPolicy='no-referrer';img.src=im.dataset.full||im.currentSrc||im.src;img.alt=im.alt;cap.textContent=im.alt;}
    function open(el){last=el.querySelector('.g-open')||el;show(vis().indexOf(el));lb.classList.add('open');lb.querySelector('.x').focus();}
    function close(){lb.classList.remove('open');if(last)last.focus();}
    function prep(){gallery.querySelectorAll('.g-item').forEach(function(el){if(el.querySelector('.g-open'))return;var im=el.querySelector('img');
      var b=document.createElement('button');b.type='button';b.className='g-open';b.setAttribute('aria-label','View photo'+(im&&im.alt?': '+im.alt:''));el.appendChild(b);});}
    prep(); new MutationObserver(prep).observe(gallery,{childList:true});
    gallery.addEventListener('click',function(e){var el=e.target.closest('.g-item');if(el)open(el);});
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
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}});},{rootMargin:'0px 0px 25% 0px'});
    document.querySelectorAll('.rv-in').forEach(function(el){io.observe(el);});
  } else document.querySelectorAll('.rv-in').forEach(function(el){el.classList.add('on');});

  // Enquiry form -> opens WhatsApp to Sandip with every detail pre-typed,
  // and also saves a copy to the Google Sheet in the background.
  function fmtDate(v){
    if(!v)return '';
    var d=new Date(v+'T00:00:00');if(isNaN(d))return v;
    return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  }
  function isMobile(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches;}
  function esc(t){return String(t||'').replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});}

  document.querySelectorAll('form[data-enquiry]').forEach(function(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!form.reportValidity())return;
      if(form.website&&form.website.value)return; // spam bot
      var d={};new FormData(form).forEach(function(v,k){d[k]=String(v).trim();});
      d.ref='TUS-'+Date.now().toString().slice(-6);
      d.source='Website enquiry form';
      d.submittedAt=new Date().toISOString();

      var lines=[
        '*New wedding enquiry - The Unposed Story website*',
        'Ref: '+d.ref,
        '',
        '*Name:* '+d.name,
        d.partner?'*Partner:* '+d.partner:null,
        '*WhatsApp:* '+d.phone,
        d.email?'*Email:* '+d.email:null,
        '*Wedding date:* '+fmtDate(d.date),
        d.location?'*City / venue:* '+d.location:null,
        '*Collection:* '+(d.package||'Not sure yet'),
        d.guests?'*Guests:* '+d.guests:null,
        d.message?'':null,
        d.message?'*About the wedding:*\n'+d.message:null
      ].filter(function(x){return x!==null;});
      var waUrl='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(lines.join('\n'));

      // 1) backup copy to Google Sheet (keepalive survives leaving the page)
      try{fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(d)}).catch(function(){});}catch(err){}

      // 2) show confirmation with a manual fallback button
      form.innerHTML='<div class="form-done">'+
        '<span class="done-ic" aria-hidden="true">&#10003;</span>'+
        '<h3>Almost done, '+esc(d.name.split(' ')[0])+'!</h3>'+
        '<p>WhatsApp is opening with your details already filled in. <strong>Just tap Send</strong> and Sandip will reply within 24 hours.</p>'+
        '<a class="btn btn-wa" href="'+waUrl+'" target="_blank" rel="noopener">'+WA_ICON+' Open WhatsApp &amp; send</a>'+
        '<p class="fine">Reference: '+d.ref+' &middot; Prefer to call? <a href="tel:+'+WA_NUMBER+'">+91 70452 78377</a></p></div>';

      form.scrollIntoView({behavior:'smooth',block:'center'});
      // 3) open WhatsApp straight away (inside the click, so browsers allow it)
      if(isMobile()){ window.location.href=waUrl; }
      else { window.open(waUrl,'_blank','noopener'); }
    });
  });
})();
