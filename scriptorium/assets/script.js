// Scriptorium 框架深度解析 - 交互脚本

document.addEventListener('DOMContentLoaded', function() {
  const progressBar = document.getElementById('progress-bar');
  const backToTop = document.getElementById('back-to-top');
  const tocLinks = document.querySelectorAll('.toc-link');

  // 滚动进度条
  function updateProgressBar() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    if (progressBar) {
      progressBar.style.width = progress + '%';
    }
  }

  // 返回顶部按钮
  function toggleBackToTop() {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }

  // 返回顶部
  if (backToTop) {
    backToTop.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // 高亮当前章节
  function highlightCurrentChapter() {
    const currentPath = window.location.pathname;
    const currentPage = currentPath.split('/').pop();

    tocLinks.forEach(function(link) {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === currentPage || 
          (currentPage === '' && href === 'index.html') ||
          (currentPage === 'index.html' && href === 'index.html')) {
        link.classList.add('active');
      }
    });
  }

  // 滚动监听
  window.addEventListener('scroll', function() {
    updateProgressBar();
    toggleBackToTop();
  });

  // 初始化
  updateProgressBar();
  toggleBackToTop();
  highlightCurrentChapter();

  // 键盘导航
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const nextLink = document.querySelector('.nav-link.next');
      if (nextLink) {
        window.location.href = nextLink.getAttribute('href');
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const prevLink = document.querySelector('.nav-link.prev');
      if (prevLink) {
        window.location.href = prevLink.getAttribute('href');
      }
    } else if (e.key === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.key === 'End') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  });
});
