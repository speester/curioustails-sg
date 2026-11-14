/* K-145 channel join sections: click measurement and off-screen pause.
   Without JS both sticker links are plain links and the phone demo still plays. */
(function () {
  'use strict';

  // channel_join: one event per CTA activation (mouse, touch or Enter on the link).
  // A click is intent to join, not a join: neither app reports back who joined.
  // No personal data: channel, section, environment and the page URL without its query.
  function track(a, navigateAfter) {
    var params = {
      channel: a.dataset.cjChannel,
      section: a.dataset.cjSection,
      environment: window.cjEnv || 'staging',
      page_location: location.origin + location.pathname
    };
    if (!navigateAfter) {
      window.gtag && gtag('event', 'channel_join', params);
      return;
    }
    // Same-tab navigation (an in-app browser that ignores target=_blank). GA4 queues the hit
    // and sends it in a batch, so event_callback fires on queue, not on send. What carries the
    // hit is GA4's own pagehide flush: fetch(..., { keepalive: true }), which outlives the page
    // (K-145, measured). The callback plus a short cap only keeps the click from feeling stuck.
    var gone = false;
    function go() { if (!gone) { gone = true; location.href = a.href; } }
    params.event_callback = go;
    params.event_timeout = 800;
    setTimeout(go, 900);
    window.gtag && gtag('event', 'channel_join', params);
  }

  document.querySelectorAll('a[data-cj-channel]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      // A new tab (target=_blank, or a modifier key) leaves this page alive, so the hit lands.
      var newTab = a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (newTab || e.defaultPrevented) { track(a, false); return; }
      e.preventDefault();
      track(a, true);
    });
    // Middle click opens a tab without a click event.
    a.addEventListener('auxclick', function (e) { if (e.button === 1) track(a, false); });
  });

  // Pause the demo loop while its section is off screen.
  if ('IntersectionObserver' in window) {
    document.querySelectorAll('.cj-has-demo').forEach(function (block) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { block.classList.toggle('is-idle', !en.isIntersecting); });
      }).observe(block);
    });
  }
})();
