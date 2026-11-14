/* K-132 channel join block: app selector and off-screen pause.
   Without JS the block still works: both sticker links are plain links and
   the phone plays the Telegram demo. */
(function () {
  'use strict';

  var DEMO = {
    tg: 'The phone shows a Telegram channel post with a puppy photo, breed, price, gender, age and puppy ID, then a tap on Join and a tap on the bell to turn notifications on.',
    wa: 'The phone shows a WhatsApp channel post with a puppy photo, breed, price, gender, age and puppy ID, then a tap on Follow and a tap on the bell to turn notifications on.'
  };

  document.querySelectorAll('.cj-k132').forEach(function (block) {
    var buttons = block.querySelectorAll('.cj-seg button');
    var note = block.querySelector('.cj-demo-note');

    function restart() {
      // Restart the loop so the new app's demo plays from the first frame.
      block.querySelectorAll('.cj-screen *').forEach(function (el) {
        el.style.animation = 'none';
      });
      void block.offsetWidth;
      block.querySelectorAll('.cj-screen *').forEach(function (el) {
        el.style.animation = '';
      });
    }

    function pick(ch) {
      if (block.dataset.ch === ch) return;
      block.dataset.ch = ch;
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.ch === ch)); });
      if (note) note.textContent = DEMO[ch];
      restart();
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(b.dataset.ch); });
      // Left / Right move between the two options, like a segmented control.
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
        next.focus();
        pick(next.dataset.ch);
      });
    });

    // Pause the loop while the block is off screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { block.classList.toggle('is-idle', !en.isIntersecting); });
      }).observe(block);
    }
  });
})();
