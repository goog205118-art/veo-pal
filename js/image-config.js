// Shared image generation UI/runtime configuration.
(function (window) {
    'use strict';

    const promptTags = [
        { group: '环境', label: '高山岩地', text: 'rugged alpine terrain, weathered rocks, expedition campsite' },
        { group: '环境', label: '沙漠硬光', text: 'remote desert plateau, dust in the air, hard sunlight' },
        { group: '光影', label: '金色电影光', text: 'cinematic golden hour lighting, long shadows, premium outdoor commercial look' },
        { group: '光影', label: '阴天轮廓光', text: 'dramatic overcast sky, high contrast rim light, volumetric atmosphere' },
        { group: '镜头', label: '35mm 主视觉', text: '35mm product hero shot, shallow depth of field, realistic perspective' },
        { group: '镜头', label: '微距细节', text: 'macro detail shot, tactile material texture, crisp industrial design' },
        { group: '材质', label: '硬核工业材质', text: 'matte black anodized aluminum, reinforced nylon, rugged utilitarian finish' },
        { group: '社媒', label: '海报留白', text: 'clean negative space for headline, premium e-commerce hero composition' }
    ];

    function getRefIntents() {
        return Array.isArray(window.VeoMedia && window.VeoMedia.refIntents)
            ? window.VeoMedia.refIntents
            : [];
    }

    window.VeoImageConfig = {
        clickCooldownMs: 3000,
        getRefIntents,
        previewLimit: 6,
        promptTags
    };
})(window);
