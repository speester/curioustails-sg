# PROJECT CONFIG — fill once per project. Every skill reads its values from here.
# Leave a value blank and the relevant skill will STOP and ask before proceeding.
# Store real secrets in environment variables; reference them here by NAME only.

## ── BUSINESS IDENTITY [REQUIRED before research] ──
BUSINESS_NAME:            Curious Tails
BUSINESS_TYPE:            Licensed pet shop selling puppies
LEGAL_ENTITY_ID:          ACRA 202420075D  (company registration — NOT the AVS licence)
AVS_LICENSE_NO:           AS24J00046  (the AVS pet shop licence — display this as "the licence")
LICENSE_INFO:             AVS Licensed, licence no. AS24J00046 — verifiable at https://avs.nparks.gov.sg/outreach/resources/public-registry-of-avs-licensed-pet-shops/
OWNER_NAME:               Nelson and Kim
OWNER_CREDENTIALS:        AVS licensed pet shop owners, 2+ years operating

## ── CONTACT & LOCATION [REQUIRED before build] ──
PRIMARY_CITY:             Singapore
SERVICE_AREAS:            Singapore only
FULL_ADDRESS:             2 Balestier Road #01-701 S320002 Singapore
PHONE:                    82206480
WHATSAPP:                 82206480
EMAIL:                    hello@curioustails.sg
BUSINESS_HOURS:           Weekdays 12pm–6pm, Weekends 10am–6pm
GOOGLE_MAPS_EMBED:        https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7977.498996742476!2d103.84101967571235!3d1.3262440616497237!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31da1947eb0c073d%3A0xb4c1905c6481624!2sCurious%20Tails!5e0!3m2!1sen!2ssg!4v1782792386135!5m2!1sen!2ssg
GBP_URL:                  https://www.google.com/search?kgmid=%2Fg%2F11w_rhg9mv&hl=en-SG&q=Curious%20Tails&shem=epsd1%2Cltae%2Crimspwouoe&shndl=30&source=sh%2Fx%2Floc%2Fosrp%2Fm5%2F1&kgs=55815e01232c6471
SOCIAL_PROFILES:          https://www.instagram.com/curioustails.pups/, https://www.facebook.com/profile.php?id=61573140013505

## ── BRAND & VOICE [REQUIRED before content] ──
BRAND_VOICE_WORDS:        warm, neighbourly, generous
TONE:                     friendly-expert, reassuring, practical
PRIMARY_CTA:              WhatsApp us
PRIMARY_CTA_GOAL:         message
PRICE_RANGE:              $2,888–$4,488
KEY_OFFER:                Starter kit (30+ items, $500+ value) + free home delivery & setup + free AVS-certified training lesson — included with every puppy

## ── SEO STRATEGY [REQUIRED before research] ──
SILO_MODEL:               breed
SILO_ITEMS:               Cavapoo, Maltipoo, Mini Dachshund, Corgi, Shiba Inu, Bichonpoo, Cockapoo
PRIMARY_KEYWORD:          puppy for sale Singapore
WORDS_TO_AVOID:           pedigree, DNA, Malay
COUNTRY:                  Singapore
LANGUAGE:                 en

## ── TECH & DEPLOY [REQUIRED before build/launch] ──
DOMAIN:                   https://curioustails.sg
STACK:                    Astro + Tailwind + Cloudflare
CLOUDFLARE_PROJECT:       # TO FILL — Cloudflare Pages project name
ALLOW_STICKY_MOBILE_CTA:  yes

## ── API KEYS (set actual secrets in env; name them here) ──
DATAFORSEO_ENV:           DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD
KIE_AI_ENV:               KIE_API_KEY
KIE_AI_MODEL:             nano-banana-2-lite
GA4_MEASUREMENT_ID:       # TO FILL — G-XXXXXXX
GOOGLE_PLACES_ENV:        N/A

## ── FILE PATHS (defaults — usually leave as-is) ──
CONTEXT_FILE:    ./business-context.md
EXPERTISE_FILE:  ./expertise-library.md
RESEARCH_FILE:   ./research/research.json
BLUEPRINT_FILE:  ./research/site-blueprint.csv
DESIGN_SYSTEM:   ./.claude/commands/shared/design-system.md

## ── IMAGE NAMING CONVENTION ──
When generating images via image-gen skill, use this filename pattern:
[sequence]-[breed/entity]-[section]-[keyword/lsi].png

Required components:
1. Main keyword (puppy, cavapoo, maltipoo, starter-kit, delivery, etc.)
2. Entity (curioustails, balestier, avs-licensed, singapore, etc.)
3. LSI keyword from page brief (hero, settling-in, playpen, training, home-setup, etc.)

Examples:
- 1-cavapoo-puppy-hero-balestier.png (hero section, includes breed + location + main keyword)
- 2-maltipoo-puppy-playpen-settling-in.png (settling-in section, includes LSI + context)
- 3-starter-kit-delivery-setup-curioustails.png (starter kit section, includes entity + LSI keywords)

Purpose: Filenames indexed by search engines + asset systems. Keywords + entities improve SEO signal for image packs.
