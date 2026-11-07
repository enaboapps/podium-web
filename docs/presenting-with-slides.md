# Presenting with slides

Open a talk's editor and select **Slides**. Add a slide to any section with a title, optional text, and either a direct HTTPS image link or a YouTube video link. Use **Preview** to check it before saving.

To share a slide, select it in another section's Slide menu. The menu lists the section numbers using each slide. Editing a shared slide updates all those sections. **New slide** creates an independent slide for the selected section. **No slide** removes only that section's attachment.

Return to the talk to see the slide directly above the section's script. YouTube videos have a playable embed here, and linked images appear inline too. The speech controls stay below the section. Slides follow the current section when you move forward, back, or restart.

For a projector or external display, you can also choose **Open audience window**. Move that window onto the display, then choose **Toggle full screen**. It shows only the slide. Your script and speech controls stay in the original window. A section without a slide shows a blank audience screen.

On the main presentation screen, the embedded YouTube video starts when that section's speech finishes. Starting speech pauses the video first. You can also use the video's own Play button. If your browser blocks automatic playback, Podium shows a reminder to press Play.

The optional audience window has its own manual video controls. The two players work independently. Moving between sections sharing the same slide keeps each video player open. After the next section's speech, the main player resumes from its current position. Moving to another slide stops it. Some videos cannot be embedded because their owners restrict playback. Linked images and videos need internet access and are not downloaded with the speech audio.

Existing talks need no changes. Slides do not alter speech text, delivery presets, or cached audio. Saving a slide creates a version in History. Restoring a version restores its slides too, including versions from before slides were added. Unchanged sections retain their slides after text editing. Rewritten sections and changed paragraph or sentence splits need their slides assigned again.

## Implementation

The optional `slide` field lives on each segment, so existing version snapshots and offline document copies retain it. Sections sharing a slide carry the same slide ID and content. The authenticated `talks.saveSectionSlide` mutation updates every occurrence of that ID in one transaction and snapshots the previous state. Removing an attachment affects only the selected section.

Slide-only saves replace the cached document without invalidating audio or its prepared status. Audio identity excludes slide content. Remote media loads in the editor preview, main presentation screen, or optional audience window.

The audience window uses `/audience.html` so embedded YouTube requests include Podium's origin. An `about:blank` document causes YouTube Error 153. The presenter accepts the ready message only from its own audience window and the same origin. The service worker precaches the empty audience shell for offline text slides.

Deploy the updated Convex schema and functions together with the frontend. No migration is needed for existing talks.

YouTube embeds follow the [official player documentation](https://developers.google.com/youtube/player_parameters). Podium extracts a video ID from supported YouTube links and creates a fixed embed URL. It does not embed arbitrary supplied URLs or HTML.

The main player uses the [official IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) to pause during speech and play after the audio's ended event. Automatic playback is subject to the browser's autoplay policy.
