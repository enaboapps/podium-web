# Podium — What ElevenLabs and Azure can actually do

*Researched 30 Sep 2026 against the current vendor docs (sources at the bottom).*

The purpose of this document is to decide which word/segment "presets" Podium's edit-talk flow can offer, and how each preset should be rendered for each provider, so that nothing the user picks is silently ignored.

---

## 1. The one-paragraph summary

**Azure** is controlled with **SSML markup** (tags around words). Standard "Neural" voices support almost everything: speed, pitch, volume, pauses, emphasis, spelling out, pronunciation and emotional styles. However, the newer **HD voices support much less** — they ignore speed/pitch/volume/emphasis entirely.

**ElevenLabs** does **not** use SSML for delivery. It is controlled by (a) **how the text is written** (punctuation, CAPS, ellipses), (b) **whole-request settings** (speed, stability, style) and (c) on the newest models (**v3 / v4**), **inline audio tags** such as `[whispers]` or `[excited]`. Only the older models accept a `<break>` tag, and only one old model accepts `<phoneme>`.

**Consequence for Podium:** a preset has to be an *intent* ("Pause", "Stress this", "Spell it out", "Whisper") that is *translated* per provider/model — not a raw SSML value.

---

## 2. Azure Speech

### 2.1 Voice families (this matters more than anything else)

| Family | Example name | SSML support |
|---|---|---|
| **Neural (standard)** — 500+ voices | `en-US-GuyNeural`, `en-GB-RyanNeural` | Full SSML |
| **DragonHD** — ~30 voices | `en-US-Ava:DragonHDLatestNeural` | Subset — **no prosody, no emphasis, no express-as**; break, phoneme, say-as, sub OK |
| **DragonHD Omni** — 700+ voices | `en-US-Ava:DragonHDOmniLatestNeural` | Subset — **no prosody, no emphasis, no break, no phoneme**; express-as styles, say-as, sub OK |
| **DragonHD Flash** | `en-US-Tiana:DragonHDFlashLatestNeural` | Similar to HD; en-US/zh-CN only |

HD voices sound more natural and pick emotion from the meaning of the text automatically, but give you fewer knobs.

### 2.2 Element-by-element

| Control | SSML | Neural | DragonHD | HD Omni | Notes |
|---|---|---|---|---|---|
| Speed | `<prosody rate="…">` | ✅ word-level | ❌ | ❌ | 0.5×–2× (`0.75`, `-25%`, `x-slow`…`x-fast`) |
| Pitch | `<prosody pitch="…">` | ⚠️ sentence-level | ❌ | ❌ | 0.5×–1.5×; `+10%`, `-2st`, `x-low`…`x-high`. Docs say pitch "can be applied at the sentence level" — per-word pitch is unreliable |
| Volume | `<prosody volume="…">` | ⚠️ sentence-level | ❌ | ❌ | `0–100`, `+10`, `+20%`, `silent/x-soft/soft/medium/loud/x-loud`. **`dB` units are not in Azure's documented list** |
| Pitch contour / range | `<prosody contour/range>` | ✅ | ❌ | ❌ | Contour doesn't work on single words/short phrases |
| Emphasis | `<emphasis level>` | ⚠️ **3 voices only** | ❌ | ❌ | Only `en-US-GuyNeural`, `en-US-DavisNeural`, `en-US-JaneNeural`. Levels `reduced/none/moderate/strong`. Ignored on every other voice |
| Pause | `<break time>` | ✅ | ✅ | ❌ | 0–20 000 ms (or `strength` x-weak 250 ms … x-strong 1250 ms) |
| Silence rules | `<mstts:silence>` | ✅ | ❌ | ❌ | Leading/trailing/between sentences/at commas, 0–20 s |
| Emotional style | `<mstts:express-as style styledegree role>` | ⚠️ some voices | ❌ | ✅ | Neural: per-voice style list (e.g. cheerful, sad, whispering, excited, serious, calm, shouting, hopeful…), `styledegree` 0.01–2, roles (Girl, SeniorMale…). Omni: ~60 styles (whispering, excited, calm, serious, sad, confident, urgent, reflective…). Applies to whole sentences |
| Paralinguistics | `[laughter]`, `[sighing]`… | ❌ | ✅ | ✅ | laughter, coughing, throat_clearing, breathing, sighing, yawning |
| Spell out | `<say-as interpret-as="characters">` | ✅ | ✅ | ✅ | Also `spell-out`, `alphanumeric` |
| Numbers/dates etc. | `<say-as>` | ✅ | ✅ | ✅ | cardinal, ordinal, number_digit, fraction, date (dmy/mdy…), time, duration, telephone, currency, unit, address, name |
| Say this instead | `<sub alias="…">` | ✅ | ✅ | ✅ | "W3C" → "World Wide Web Consortium". Best cross-voice pronunciation fix |
| Exact pronunciation | `<phoneme alphabet="ipa" ph="…">` | ✅ | ✅ | ❌ | ipa, sapi, ups, x-sampa. Invalid phones → HTTP 400 |
| Custom dictionary | `<lexicon uri>` | ✅ | alias only | alias only | Public URL, ≤100 KB, cached 15 min, one locale per file |
| Language/accent switch | `<lang xml:lang>` | multilingual voices | ✅ | ✅ | |
| Randomness | `parameters="temperature=…"` | ❌ | ✅ | ✅ | Omni also top_p, top_k, cfg_scale (cfg_scale also affects speed) |

**Also:** `&`, `<`, `>` in text **must** be escaped (`&amp;` etc.) or the request fails.

### 2.3 Azure take-aways for Podium

* Per-word **rate** is the only prosody control Azure promises at word level. Pitch and volume are best applied to a whole segment/sentence.
* `<emphasis>` is effectively a **three-voice feature**. For other Neural voices, emulate stress with prosody (slightly slower + louder + slightly higher). For HD voices, there is no reliable per-word stress.
* If Podium ever lets users pick HD voices, most of the current editor does nothing for them.

---

## 3. ElevenLabs

### 3.1 Models (current as of 30 Sep 2026)

| Model ID | Notes |
|---|---|
| `eleven_v4` | **Launched 28 Sep 2026.** Most expressive, 90+ languages, audio tags, improved IPA via `/…/` |
| `eleven_v4_turbo` | v4 at ~150 ms latency |
| `eleven_v3` | Audio tags; 5 000 char limit; not fully optimised for Professional Voice Clones |
| `eleven_multilingual_v2` | **API default.** Stable, good number reading. What Podium currently uses (by default, via js-tts-wrapper) |
| `eleven_flash_v2_5` | ~75 ms, cheap, weaker at normalising numbers |
| `eleven_flash_v2` | English only; the **only** model with `<phoneme>` support |
| `eleven_turbo_v2(_5)` | Deprecated → use flash |

### 3.2 Control-by-control

| Control | How | v2 / Flash | v3 / v4 | Notes |
|---|---|---|---|---|
| Speed | `voice_settings.speed` | ✅ **whole request only** | ✅ whole request | 0.7–1.2. **No per-word speed on any model** |
| Pitch | — | ❌ | ❌ | No pitch control at all (choose a different voice) |
| Volume | — | ❌ | ❌ via settings; `[whispers]`, `[shouts]` tags approximate it | |
| Pause | `<break time="1.5s"/>` | ✅ ≤3 s | ❌ **not supported** | Too many breaks → instability/speed artefacts. v3/v4: use `[pause]`, `[long pause]`, `…`, `—` |
| Emphasis | CAPITALS, punctuation | ✅ (approximate) | ✅ (better) | e.g. "This is VERY important." No emphasis tag exists |
| Emotion / delivery | Audio tags `[…]` | ❌ (stripped/spoken) | ✅ | Free text: `[whispers]`, `[excited]`, `[sad]`, `[sarcastic]`, `[calmly]`, `[laughs]`, `[sighs]`, even `[dry, quietly pleased]`. Applies from the tag onwards, not to a precise word range. In our tests on v4, a `[pause]` / `[long pause]` tag ended the mood, so Podium restates the mood tag after each pause |
| Expressiveness | `voice_settings.stability` (0–1, default 0.5), `style` (0–1), `similarity_boost` | ✅ | ✅ (v3 uses Creative / Natural / Robust stability modes) | Whole-request only. Lower stability = more emotional range, less consistent |
| Spell out | Write it spaced: "N. A. S. A." | ✅ | ✅ | No say-as tag; text transform works everywhere |
| Say this instead | Replace the text, or pronunciation-dictionary `alias` | ✅ | ✅ (alias via text) | Dictionary: up to 3 per request, `.pls`/`.txt`, case-sensitive |
| Exact pronunciation | `<phoneme alphabet="cmu-arpabet"/"ipa">` | ✅ **flash_v2 only** | v4: `/ˌbaɪoʊˈkemɪstri/` inline IPA | Single words only |
| Continuity | `previous_text` / `next_text` / `previous_request_ids` | ✅ | ✅ | Makes segment-by-segment playback sound joined-up — worth using in Podium since talks are played in segments |
| Determinism | `seed` | ✅ | ✅ | "Not guaranteed", but helps consistency between rehearsal and delivery |
| Number/date reading | `apply_text_normalization` auto/on/off | ✅ | ✅ | |

### 3.3 ElevenLabs take-aways for Podium

* ElevenLabs cannot do per-word speed, pitch or volume. It **can** do: pauses, stress (via CAPS), spelling out, substitutions, and (v3/v4) emotion tags.
* Which of those work depends on the **model**, so Podium must know the model (today it doesn't choose one — it gets the library default `eleven_multilingual_v2`).
* js-tts-wrapper **strips SSML** for ElevenLabs and strips `[tags]` unless the model is `eleven_v3`. To send `<break>` or tags, Podium needs to call the API directly (or configure the wrapper) rather than rely on its defaults.

---

## 4. Side-by-side: what a Podium preset can promise

✅ works · ≈ approximated · ❌ not possible

| Intent (what the user wants) | Azure Neural | Azure HD / Omni | ElevenLabs v2 / Flash | ElevenLabs v3 / v4 |
|---|---|---|---|---|
| **Pause after this word** | ✅ `<break>` up to 20 s | ✅ HD / ❌ Omni (use `…`) | ✅ `<break>` ≤3 s | ≈ `[pause]` / `…` |
| **Stress this word** | ✅ `<emphasis>` on 3 voices; ≈ prosody otherwise | ≈ CAPS | ≈ CAPS | ✅ CAPS (better) |
| **Say this part slower / faster** | ✅ per word | ❌ | ❌ (whole segment only) | ≈ `[slowly]` tag / whole segment |
| **Higher / lower / louder / softer** | ≈ sentence-level | ❌ | ❌ | ≈ `[whispers]`, `[shouts]` |
| **Mood for this sentence** (calm, excited, serious, sad, whisper) | ⚠️ only voices with styles | ✅ Omni styles | ❌ (≈ stability) | ✅ audio tags |
| **Spell it out** (e.g. "BBC") | ✅ say-as | ✅ say-as | ✅ spaced letters | ✅ spaced letters |
| **Say it like…** ("Siobhan" → "shiv-awn") | ✅ `<sub>` / phoneme | ✅ `<sub>` | ✅ replace text | ✅ replace text / `/IPA/` |
| **Numbers, dates, phone numbers** | ✅ say-as | ✅ say-as | ✅ normalisation | ✅ normalisation |
| **Whole-talk pace** | ✅ prosody on everything | ❌ (≈ cfg_scale on Omni) | ✅ speed 0.7–1.2 | ✅ speed |

**The common ground** — works everywhere, word-level: **Pause**, **Stress**, **Spell out**, **Say it like…**.
**Segment-level (whole sentence/paragraph):** **Mood** and **Pace** — the only level at which both providers can do them reliably.

---

## 5. Suggested simplification for the edit-talk flow

### Today

13 word modes (Emphasise, Dramatic, Whisper, Excited, Slow, Fast, Loud, Soft, Spell out, four pause lengths, Clear) that stack in surprising ways, all rendered only as Azure SSML. ElevenLabs users (the default provider) get none of it.

### Proposal — two layers, six choices

**A. Per segment: "How should this part sound?"** (one tap, applies to the whole segment)
* **Mood:** Normal · Calm · Warm · Excited · Serious · Sad · Whisper
* **Pace:** Slower · Normal · Faster

**B. Per word: four tools**
1. **Pause** — Short / Medium / Long (≈ 0.5 s / 1 s / 2 s; clamped to 3 s on ElevenLabs v2)
2. **Stress** — on / off
3. **Spell out** — on / off
4. **Say it like…** — type how it should sound (stored as a substitution; also feeds the unused `pronunciations` table so it can apply across all talks)

Each choice is stored as an intent, and a per-provider "renderer" turns it into the right markup:

| Intent | Azure Neural | ElevenLabs v2 / Flash | ElevenLabs v3 / v4 |
|---|---|---|---|
| Mood: Whisper | `express-as style="whispering"` if the voice supports it, else `prosody volume="x-soft" rate="0.9"` | (none — tell user) | `[whispers]` |
| Mood: Excited | `express-as style="excited"` / else `prosody rate="1.1" pitch="+10%"` | lower stability | `[excited]` |
| Mood: Serious | `express-as style="serious"` / else `prosody rate="0.9" pitch="-5%"` | — | `[serious]` |
| Pace: Slower | `prosody rate="0.85"` | `speed: 0.85` | `speed: 0.85` |
| Pause: Medium | `<break time="1000ms"/>` | `<break time="1.0s"/>` | `…` / `[pause]` |
| Stress | `<emphasis>` (3 voices) / else `prosody rate="0.9" volume="+20%"` | WORD in caps | WORD in caps |
| Spell out | `<say-as interpret-as="characters">` | "B. B. C." | "B. B. C." |
| Say it like… | `<sub alias="…">` | replace text | replace text |

The UI should grey out, or label as "approximate", any preset the current provider/voice/model can't honour, instead of silently dropping it.

---

## 6. Bugs and gaps found in Podium while researching

1. **ElevenLabs gets no styling at all.** `TalkPresentationPage.tsx` sends plain `segment.text` unless the provider is Azure, so every word effect is dropped for the default provider.
2. **Saving the text wipes all word styling.** `saveEditedText` rewrites segments as `{id, text}`; `elements` is discarded for every segment in the talk, with no warning.
3. **Segment IDs are array positions**, so re-splitting can attach saved styling to the wrong segment.
4. **Loud = `volume="+6dB"`** — `dB` isn't one of Azure's documented volume formats; use `+20%` or `loud`.
5. **Pitch/volume applied per word** — Azure only honours these at sentence level, so Dramatic/Excited/Loud/Soft on single words may do little.
6. **`<emphasis>` only works on 3 Azure voices**; users on any other voice get nothing when they press Emphasise.
7. **SSML text isn't XML-escaped** — an `&` or `<` in a script breaks synthesis.
8. **Test button is Azure-only** in the editor; ElevenLabs users can't preview.
9. **No ElevenLabs model is chosen** — Podium gets the wrapper default (`eleven_multilingual_v2`), so it can't use v3/v4 tags; the wrapper also strips SSML and tags.
10. **Unused schema:** `segments.tempo`, `segments.emphasis`, `talks.voiceId`, `pronunciations`, `acronymRules`, the `tag` element type, and `getEffectDots` — the first four map neatly onto the proposal above (Pace, Stress, Say it like…).
11. **Audio cache includes elements for ElevenLabs** even though they're ignored, so editing styles re-bills identical audio.

---

## Sources

* Azure — voice & prosody SSML: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice
* Azure — SSML structure (break, silence, escaping): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-structure
* Azure — pronunciation (phoneme, lexicon, say-as, sub): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-pronunciation
* Azure — HD voices & supported SSML: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices
* ElevenLabs — prompting controls: https://elevenlabs.io/docs/best-practices/prompting/controls
* ElevenLabs — best practices: https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
* ElevenLabs — models: https://elevenlabs.io/docs/overview/models
* ElevenLabs — TTS API parameters: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
* ElevenLabs — Eleven v4 launch: https://elevenlabs.io/blog/eleven-v4
