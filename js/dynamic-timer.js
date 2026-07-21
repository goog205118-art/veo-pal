// Lightweight DOM timer for running image/video task cards.
(function (window) {
    'use strict';

    let timerId = 0;

    function formatElapsed(startTime) {
        const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const minutes = String(Math.floor(diff / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function update() {
        document.querySelectorAll('.veo-dynamic-timer').forEach((el) => {
            const startTime = parseInt(el.getAttribute('data-start-time'), 10);
            if (!startTime) return;
            el.innerText = formatElapsed(startTime);
        });
    }

    function start() {
        if (timerId) return timerId;
        update();
        timerId = window.setInterval(update, 1000);
        return timerId;
    }

    function stop() {
        if (!timerId) return;
        window.clearInterval(timerId);
        timerId = 0;
    }

    window.VeoDynamicTimer = {
        formatElapsed,
        start,
        stop,
        update
    };

    start();
})(window);
