(function () {
    'use strict';

    const masthead    = document.getElementById('masthead');
    const menuTrigger = document.getElementById('menuTrigger');
    const navClose    = document.getElementById('navClose');
    const primaryNav  = document.getElementById('primaryNav');
    const yearStamp   = document.getElementById('year');

    const pinThreshold = 60;
    const handleScroll = () => {
        if (!masthead) return;
        masthead.classList.toggle('is-pinned', window.scrollY > pinThreshold);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const openMenu  = () => primaryNav && primaryNav.classList.add('is-open');
    const closeMenu = () => primaryNav && primaryNav.classList.remove('is-open');

    if (menuTrigger) menuTrigger.addEventListener('click', openMenu);
    if (navClose)    navClose.addEventListener('click', closeMenu);

    if (primaryNav) {
        primaryNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    if (yearStamp) yearStamp.textContent = String(new Date().getFullYear());
})();
