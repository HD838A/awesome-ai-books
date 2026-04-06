(function() {
  var bar = document.getElementById('progress-bar');
  if (bar) {
    window.addEventListener('scroll', function() {
      var s = document.documentElement, scrollTop = s.scrollTop || document.body.scrollTop;
      var scrollH = s.scrollHeight - s.clientHeight;
      bar.style.width = (scrollH > 0 ? (scrollTop / scrollH * 100) : 0) + '%';
    });
  }
  var btn = document.getElementById('back-to-top');
  if (btn) {
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 300);
    });
    btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  var links = document.querySelectorAll('.toc-list a');
  if (links.length) {
    window.addEventListener('scroll', function() {
      var s = document.documentElement, fromTop = s.scrollTop + 100;
      links.forEach(function(link) {
        var sec = document.getElementById(link.getAttribute('href').slice(1));
        if (sec && sec.offsetTop <= fromTop) {
          document.querySelectorAll('.toc-list a').forEach(function(l) { l.classList.remove('active'); });
          link.classList.add('active');
        }
      });
    });
  }
})();