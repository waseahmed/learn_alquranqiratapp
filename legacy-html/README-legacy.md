# Al Quran Qirat Academy – Full Quran Qari Voice Practice

## What this package contains

- Full Qur'an Arabic text stored locally (114 Surahs / 6,236 ayahs).
- Full-Qur'an navigation.
- All 30 Juz shortcuts.
- Popular Surah shortcuts: Al-Kahf, Yā-Sīn, Ar-Raḥmān, Al-Wāqiʿah, Al-Mulk, Al-Muzzammil, Ad-Duḥā.
- 10 selectable Qaris.
- No synthetic humming.
- Replay and 0.8× practice.
- Shadow Mode: listen to an āyah, get a 3-second imitation window, repeat.
- Browser microphone recording for A/B comparison (requires HTTPS or localhost).
- “How to Imitate a Qari” teaching page.
- “Common Mistakes” teaching page.
- Self-hosted audio URLs only.

## Audio path convention

The public app never calls a third-party recitation URL.

Example:

    audio/recitations/husary/001/001001.mp3
    audio/recitations/minshawi/036/036012.mp3
    audio/recitations/mishary/114/114006.mp3

Filename convention is `SSSAAA.mp3`.

## Admin-only audio import

Run:

    admin\download-full-quran-audio.bat

This downloads verse-by-verse archives from the configured source and organizes the MP3s into your local hosting folders.

Then run:

    admin\verify-audio.bat

to see how many of the expected 6,236 files exist for each Qari.

### Important

Some public reciter archives can contain missing files or can change later. The verification script is included specifically so you can detect gaps before publishing. Keep a backup of the final `audio/recitations` directory once you have validated it.

Before redistributing or publicly hosting recitation recordings, review the relevant source/recording usage terms. The application architecture itself does not require a third-party audio service after you have populated your own library.

## Recommended deployment

Upload everything to your web server:

    /index.html
    /assets/
    /data/
    /audio/recitations/

Do not expose `/admin/` publicly if possible. Keep the admin scripts locally or outside your web root.

For microphone recording, host the site over HTTPS.
