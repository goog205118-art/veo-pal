(function () {
    'use strict';

    var root = document.querySelector('.register-shell');
    var form = document.getElementById('register-form');
    var nextBtn = document.getElementById('register-next');
    var backBtn = document.getElementById('register-back');
    var submitBtn = document.getElementById('register-submit');
    var feedback = document.getElementById('register-feedback');
    var successPanel = document.getElementById('register-success');
    var successCopy = document.getElementById('register-success-copy');
    var emailInput = document.getElementById('register-email');
    var nameInput = document.getElementById('register-name');
    var passwordInput = document.getElementById('register-password');
    var confirmInput = document.getElementById('register-confirm');
    var profileInput = document.getElementById('register-profile');
    var meter = document.querySelector('.password-meter span');

    var state = {
        step: 1,
        submitting: false
    };

    function setFeedback(message, isError) {
        if (!feedback) return;
        feedback.textContent = message || '';
        feedback.classList.toggle('is-error', !!isError);
    }

    function setInvalid(input, invalid) {
        var field = input && input.closest ? input.closest('.floating-field') : null;
        if (field) field.classList.toggle('is-invalid', !!invalid);
    }

    function isEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    }

    function setStep(step) {
        state.step = step;
        if (root) root.dataset.step = String(step);
        document.querySelectorAll('[data-step-panel]').forEach(function (panel) {
            panel.classList.toggle('is-active', panel.dataset.stepPanel === String(step));
        });
        document.querySelectorAll('[data-dot]').forEach(function (dot) {
            dot.classList.toggle('is-active', Number(dot.dataset.dot) <= step);
        });
        setFeedback('');
        window.setTimeout(function () {
            var nextFocus = step === 1 ? emailInput : (nameInput || passwordInput);
            if (nextFocus && typeof nextFocus.focus === 'function') nextFocus.focus();
        }, 220);
    }

    function getPasswordScore(password) {
        var value = String(password || '');
        var score = 0;
        if (value.length >= 8) score += 1;
        if (value.length >= 12) score += 1;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
        if (/\d/.test(value)) score += 1;
        if (/[^A-Za-z0-9]/.test(value)) score += 1;
        return Math.min(score, 5);
    }

    function updatePasswordMeter() {
        if (!meter || !passwordInput) return;
        var score = getPasswordScore(passwordInput.value);
        meter.style.width = Math.max(8, score * 20) + '%';
    }

    function validateStepOne() {
        var ok = isEmail(emailInput && emailInput.value);
        setInvalid(emailInput, !ok);
        if (!ok) {
            setFeedback('请先输入一个有效邮箱。', true);
            if (emailInput) emailInput.focus();
        }
        return ok;
    }

    function validateStepTwo() {
        var password = passwordInput ? passwordInput.value : '';
        var confirm = confirmInput ? confirmInput.value : '';
        var ok = true;

        setInvalid(passwordInput, false);
        setInvalid(confirmInput, false);

        if (password.length < 8) {
            setInvalid(passwordInput, true);
            setFeedback('访问密钥至少需要 8 位。', true);
            ok = false;
        } else if (password !== confirm) {
            setInvalid(confirmInput, true);
            setFeedback('两次输入的访问密钥不一致。', true);
            ok = false;
        }

        if (!ok && passwordInput) passwordInput.focus();
        return ok;
    }

    function getPayload() {
        return {
            event: 'veo_register_request',
            email: String(emailInput && emailInput.value || '').trim(),
            name: String(nameInput && nameInput.value || '').trim(),
            profile: String(profileInput && profileInput.value || '').trim(),
            password: String(passwordInput && passwordInput.value || ''),
            source: 'veo-studio-register-page',
            createdAt: new Date().toISOString()
        };
    }

    function savePendingLocally(payload) {
        var safePayload = {
            event: payload.event,
            email: payload.email,
            name: payload.name,
            profile: payload.profile,
            source: payload.source,
            createdAt: payload.createdAt,
            note: 'Password is intentionally not stored locally.'
        };

        try {
            var key = 'veo_register_pending';
            var existing = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(existing)) existing = [];
            existing.unshift(safePayload);
            localStorage.setItem(key, JSON.stringify(existing.slice(0, 10)));
        } catch (error) {
            console.warn('[Veo Register] local pending save failed:', error);
        }
    }

    async function postToWebhook(payload) {
        var webhook = String(window.VEO_REGISTER_WEBHOOK || '').trim();
        if (!webhook) {
            savePendingLocally(payload);
            return { mode: 'local' };
        }

        var controller = new AbortController();
        var timeout = window.setTimeout(function () {
            controller.abort();
        }, 15000);

        try {
            var response = await fetch(webhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error('Webhook responded with HTTP ' + response.status);
            }

            return { mode: 'webhook' };
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function showSuccess(result) {
        if (form) form.hidden = true;
        if (successPanel) successPanel.hidden = false;
        if (successCopy) {
            successCopy.textContent = result && result.mode === 'webhook'
                ? '申请已发送至 n8n 注册审核流。审核完成后，你可以回到登录页继续进入工作台。'
                : '当前尚未配置注册 Webhook，页面已保存一条本地待接入记录。真实上线时只需要填入 n8n Webhook 地址即可。';
        }
        setFeedback('');
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (state.submitting) return;
        if (!validateStepOne()) {
            setStep(1);
            return;
        }
        if (!validateStepTwo()) return;

        state.submitting = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.querySelector('span').textContent = '提交中...';
        }
        setFeedback('正在提交访问申请...');

        try {
            var result = await postToWebhook(getPayload());
            showSuccess(result);
        } catch (error) {
            console.error('[Veo Register] submit failed:', error);
            setFeedback('提交失败：请检查注册 Webhook 是否可用，或稍后重试。', true);
        } finally {
            state.submitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.querySelector('span').textContent = '提交申请';
            }
        }
    }

    function bindMagneticButtons() {
        document.querySelectorAll('.magnetic-action').forEach(function (button) {
            button.addEventListener('pointermove', function (event) {
                var rect = button.getBoundingClientRect();
                var x = (event.clientX - rect.left) / Math.max(rect.width, 1);
                button.style.setProperty('--shine-x', String((x - 0.5) * 2));
            });
            button.addEventListener('pointerleave', function () {
                button.style.removeProperty('--shine-x');
            });
        });
    }

    function initVisualCanvas() {
        var canvas = document.getElementById('reg-visual-canvas');
        if (!canvas) return;

        var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var points = [];
        var mouse = { x: 0, y: 0, active: false };
        var width = 0;
        var height = 0;
        var rafId = 0;

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = Math.max(1, rect.width);
            height = Math.max(1, rect.height);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var count = Math.max(34, Math.min(78, Math.floor(width * height / 18000)));
            points = Array.from({ length: count }, function (_, index) {
                var angle = (index / count) * Math.PI * 2;
                return {
                    x: width * (0.5 + Math.cos(angle) * (0.18 + Math.random() * 0.28)),
                    y: height * (0.5 + Math.sin(angle) * (0.14 + Math.random() * 0.3)),
                    vx: (Math.random() - 0.5) * 0.22,
                    vy: (Math.random() - 0.5) * 0.22
                };
            });
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgba(7, 7, 7, 0.18)';
            ctx.fillRect(0, 0, width, height);

            points.forEach(function (point) {
                if (!prefersReduced) {
                    point.x += point.vx;
                    point.y += point.vy;
                    if (point.x < -20 || point.x > width + 20) point.vx *= -1;
                    if (point.y < -20 || point.y > height + 20) point.vy *= -1;
                }

                if (mouse.active) {
                    var dx = point.x - mouse.x;
                    var dy = point.y - mouse.y;
                    var distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    if (distance < 180) {
                        point.x += (dx / distance) * 0.32;
                        point.y += (dy / distance) * 0.32;
                    }
                }
            });

            for (var i = 0; i < points.length; i += 1) {
                for (var j = i + 1; j < points.length; j += 1) {
                    var a = points[i];
                    var b = points[j];
                    var dx = a.x - b.x;
                    var dy = a.y - b.y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 128) {
                        ctx.strokeStyle = 'rgba(255,255,255,' + (0.13 * (1 - dist / 128)).toFixed(3) + ')';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }

            points.forEach(function (point) {
                ctx.fillStyle = 'rgba(255,255,255,0.62)';
                ctx.beginPath();
                ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
                ctx.fill();
            });

            if (!prefersReduced) rafId = window.requestAnimationFrame(draw);
        }

        canvas.addEventListener('pointermove', function (event) {
            var rect = canvas.getBoundingClientRect();
            mouse.x = event.clientX - rect.left;
            mouse.y = event.clientY - rect.top;
            mouse.active = true;
        });
        canvas.addEventListener('pointerleave', function () {
            mouse.active = false;
        });
        window.addEventListener('resize', resize);

        resize();
        draw();

        window.addEventListener('pagehide', function () {
            if (rafId) window.cancelAnimationFrame(rafId);
        });
    }

    if (!root || !form) return;

    if (nextBtn) {
        nextBtn.addEventListener('click', function () {
            if (validateStepOne()) setStep(2);
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', function () {
            setStep(1);
        });
    }

    if (emailInput) {
        emailInput.addEventListener('input', function () {
            setInvalid(emailInput, false);
            setFeedback('');
        });
        emailInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (validateStepOne()) setStep(2);
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            setInvalid(passwordInput, false);
            setInvalid(confirmInput, false);
            setFeedback('');
            updatePasswordMeter();
        });
    }

    if (confirmInput) {
        confirmInput.addEventListener('input', function () {
            setInvalid(confirmInput, false);
            setFeedback('');
        });
    }

    form.addEventListener('submit', handleSubmit);
    bindMagneticButtons();
    initVisualCanvas();
})();
