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

    const seal = document.querySelector('.seal');
    const sealNodes = seal ? Array.from(seal.querySelectorAll('.seal__node')) : [];

    if (seal && sealNodes.length) {
        const n = sealNodes.length;
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        // Auto node size: shrinks as photo count grows. Tuned so n=7 sits at ~26%.
        const nodeSize = Math.max(11, Math.min(30, 68.8 / Math.sqrt(n)));
        seal.style.setProperty('--node-size', nodeSize + '%');

        // Phyllotaxis (sunflower) positions. First node at center; rest spiral out.
        const maxR = 0.5 - (nodeSize / 200) - 0.015; // leave a margin from the seal edge
        const rMaxUnit = n > 1 ? Math.sqrt(n - 1) : 1;
        const positions = [];
        for (let i = 0; i < n; i++) {
            const r = n === 1 ? 0 : (Math.sqrt(i) / rMaxUnit) * maxR;
            const angle = i * goldenAngle;
            positions.push({
                x: 0.5 + r * Math.cos(angle),
                y: 0.5 + r * Math.sin(angle),
            });
        }

        sealNodes.forEach((node, i) => {
            node.style.setProperty('--x', (positions[i].x * 100) + '%');
            node.style.setProperty('--y', (positions[i].y * 100) + '%');
        });

        // Build connecting lines: each node to its k nearest neighbors. Dedupe pairs.
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'seal__lines');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');

        const k = Math.min(3, n - 1);
        const seen = new Set();
        for (let i = 0; i < n; i++) {
            const dists = [];
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const dx = positions[i].x - positions[j].x;
                const dy = positions[i].y - positions[j].y;
                dists.push({ j: j, d: Math.hypot(dx, dy) });
            }
            dists.sort((a, b) => a.d - b.d);
            for (let m = 0; m < k && m < dists.length; m++) {
                const j = dists[m].j;
                const key = i < j ? i + '-' + j : j + '-' + i;
                if (seen.has(key)) continue;
                seen.add(key);
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', String(positions[i].x * 100));
                line.setAttribute('y1', String(positions[i].y * 100));
                line.setAttribute('x2', String(positions[j].x * 100));
                line.setAttribute('y2', String(positions[j].y * 100));
                svg.appendChild(line);
            }
        }
        seal.insertBefore(svg, seal.firstChild);

        // Lightbox with prev/next.
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.innerHTML =
            '<button class="lightbox__close" aria-label="Close">&times;</button>' +
            '<button class="lightbox__nav lightbox__prev" aria-label="Previous">&#x2039;</button>' +
            '<button class="lightbox__nav lightbox__next" aria-label="Next">&#x203A;</button>' +
            '<figure class="lightbox__figure">' +
                '<img class="lightbox__img" src="" alt="">' +
                '<figcaption class="lightbox__caption"></figcaption>' +
            '</figure>';
        document.body.appendChild(lightbox);

        const lbImg   = lightbox.querySelector('.lightbox__img');
        const lbCap   = lightbox.querySelector('.lightbox__caption');
        const lbClose = lightbox.querySelector('.lightbox__close');
        const lbPrev  = lightbox.querySelector('.lightbox__prev');
        const lbNext  = lightbox.querySelector('.lightbox__next');

        if (n <= 1) {
            lbPrev.hidden = true;
            lbNext.hidden = true;
        }

        let currentIndex = 0;
        const showAt = (index) => {
            currentIndex = ((index % n) + n) % n;
            const node = sealNodes[currentIndex];
            const img = node.querySelector('img');
            if (!img) return;
            const caption = node.getAttribute('title') || node.getAttribute('aria-label') || '';
            lbImg.src = img.currentSrc || img.src;
            lbImg.alt = caption;
            lbCap.textContent = caption;
        };
        const openLightbox = (index) => {
            showAt(index);
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

        sealNodes.forEach((node, i) => {
            node.addEventListener('click', (e) => {
                e.preventDefault();
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                openLightbox(i);
            });
        });

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        lbClose.addEventListener('click', closeLightbox);
        lbPrev.addEventListener('click', (e) => { e.stopPropagation(); showAt(currentIndex - 1); });
        lbNext.addEventListener('click', (e) => { e.stopPropagation(); showAt(currentIndex + 1); });

        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('is-open')) return;
            if (e.key === 'Escape')         closeLightbox();
            else if (e.key === 'ArrowLeft') showAt(currentIndex - 1);
            else if (e.key === 'ArrowRight') showAt(currentIndex + 1);
        });
    }

    const embedLinks = document.querySelectorAll('a[data-embed]');
    if (embedLinks.length) {
        const embed = document.createElement('div');
        embed.className = 'embed-lightbox';
        embed.setAttribute('aria-hidden', 'true');
        embed.innerHTML =
            '<button class="embed-lightbox__close" aria-label="Close">&times;</button>' +
            '<div class="embed-lightbox__frame"></div>';
        document.body.appendChild(embed);

        const frameWrap = embed.querySelector('.embed-lightbox__frame');
        const embedClose = embed.querySelector('.embed-lightbox__close');

        const openEmbed = (url, title) => {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            if (title) iframe.title = title;
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            frameWrap.replaceChildren(iframe);
            embed.classList.add('is-open');
            embed.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        };
        const closeEmbed = () => {
            if (!embed.classList.contains('is-open')) return;
            embed.classList.remove('is-open');
            embed.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            frameWrap.replaceChildren();
        };

        embedLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                openEmbed(link.dataset.embed, link.getAttribute('title') || link.getAttribute('aria-label'));
            });
        });

        embed.addEventListener('click', (e) => { if (e.target === embed) closeEmbed(); });
        embedClose.addEventListener('click', closeEmbed);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && embed.classList.contains('is-open')) closeEmbed();
        });
    }
})();
