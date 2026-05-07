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

    const sealNodes = document.querySelectorAll('.seal__node');
    if (sealNodes.length) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.innerHTML =
            '<button class="lightbox__close" aria-label="Close">&times;</button>' +
            '<figure class="lightbox__figure">' +
                '<img class="lightbox__img" src="" alt="">' +
                '<figcaption class="lightbox__caption"></figcaption>' +
            '</figure>';
        document.body.appendChild(lightbox);

        const lbImg = lightbox.querySelector('.lightbox__img');
        const lbCap = lightbox.querySelector('.lightbox__caption');
        const lbClose = lightbox.querySelector('.lightbox__close');

        const openLightbox = (src, caption) => {
            lbImg.src = src;
            lbImg.alt = caption || '';
            lbCap.textContent = caption || '';
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        };
        const closeLightbox = () => {
            if (!lightbox.classList.contains('is-open')) return;
            lightbox.classList.remove('is-open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        };

        sealNodes.forEach(node => {
            node.addEventListener('click', (e) => {
                e.preventDefault();
                const img = node.querySelector('img');
                if (!img) return;
                const caption = node.getAttribute('title') || node.getAttribute('aria-label') || '';
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                openLightbox(img.currentSrc || img.src, caption);
            });
        });

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        lbClose.addEventListener('click', closeLightbox);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeLightbox();
        });
    }
})();
