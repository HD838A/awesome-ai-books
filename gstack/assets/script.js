(function() {
  // Progress bar
  var bar = document.getElementById('progress-bar');
  if (bar) {
    window.addEventListener('scroll', function() {
      var s = document.documentElement, scrollTop = s.scrollTop || document.body.scrollTop;
      var scrollH = s.scrollHeight - s.clientHeight;
      bar.style.width = (scrollH > 0 ? (scrollTop / scrollH * 100) : 0) + '%';
    });
  }
  // Back to top
  var btn = document.getElementById('back-to-top');
  if (btn) {
    window.addEventListener('scroll', function() {
      btn.classList.toggle('visible', window.scrollY > 300);
    });
    btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  // Right TOC highlight
  var tocLinks = document.querySelectorAll('.toc-list a');
  if (tocLinks.length) {
    var headings = Array.from(document.querySelectorAll('#main h2'));
    window.addEventListener('scroll', function() {
      var scrollY = window.scrollY + 80;
      var active = headings.filter(function(h) { return h.offsetTop <= scrollY; }).pop();
      tocLinks.forEach(function(a) { a.classList.remove('active'); });
      if (active) {
        var match = document.querySelector('.toc-list a[href="#' + active.id + '"]');
        if (match) match.classList.add('active');
      }
    });
  }
  // Mermaid
  if (document.querySelector('.mermaid')) {
    var s = document.createElement('script');
    s.type = 'module';
    s.textContent = 'import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"; mermaid.initialize({ startOnLoad: true, theme: "neutral" }); mermaid.run();';
    document.head.appendChild(s);
  }
  // Highlight.js
  if (document.querySelector('pre code')) {
    var hl = document.createElement('link');
    hl.rel = 'stylesheet';
    hl.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    document.head.appendChild(hl);
    var sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    sc.onload = function() { hljs.highlightAll(); };
    document.head.appendChild(sc);
  }
})();