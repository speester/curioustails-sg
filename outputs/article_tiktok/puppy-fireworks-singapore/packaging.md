# Packaging — puppy-fireworks-singapore

## Video description (TikTok search-friendly)
Is your dog scared of fireworks in Singapore? Before National Day, do this: build a safe room with the playpen, curtains drawn and aircon on, start sound desensitisation about 3 weeks early, walk your puppy early, and stay calm on the night. The fireworks start on the rehearsal nights, not just 9 August. Full plan on the Curious Tails blog.

## Hashtags
#singaporedogs #puppytips #nationaldaysg #sgdogs #fireworksanxiety

## Pinned comment (comment seed)
Most owners wait until 9 August. The NDP rehearsal Saturdays come first — that's usually your puppy's real first fireworks. When are you starting your prep?

## Cover
cover.jpg (frame 1 — calm puppy in its den). Headline is already burned in ("Fireworks start before Aug 9"); no extra in-app cover text needed.

## Distribution note
Two renders provided:
- final_article_tiktok.mp4 — full mix (narration + soft ambient bed).
- final_nomusic.mp4 — narration only. Prefer this if attaching a trending in-app sound at low volume under the narration (platform-native audio aids distribution).

## Honest build notes (for the next run / upgrade path)
- This is a stills-based build (Ken Burns on three on-brand generated images), not Veo video clips. It is a legitimate short and meets the 9:16 / duration / size gates, but a future upgrade is per-scene Veo 3.1 Lite clips with image_to_video continuity from the hero still.
- Audio is mono (edge-tts source); the skill rubric prefers stereo — a `-ac 2` upmix is a trivial future tweak.
- Caption timing is synthesised proportionally (edge-tts 7.2.8 emits no WordBoundary for SG/standard voices in this version); caption text still equals script.txt exactly. Forced alignment (whisper) would tighten sync in a future run.
