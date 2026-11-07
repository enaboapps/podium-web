# Presenting with slides

Open a talk's editor and select **Slides**. Add a slide to any section with a title, optional text, and either a direct HTTPS image link or a YouTube video link. Use **Preview** to check it before saving.

To share a slide, select it in another section's Slide menu. The menu lists the section numbers using each slide. Editing a shared slide updates all those sections. **New slide** creates an independent slide for the selected section. **No slide** removes only that section's attachment.

Return to the talk and choose **Open audience window**. Move that window onto the projector or external display, then choose **Toggle full screen**. Your script and speech controls stay in the original window. Slides follow the current section when you move forward, back, or restart. A section without a slide shows a blank audience screen.

YouTube videos play manually using the controls in the audience window. Moving between sections sharing the same slide keeps the video player open. Moving to another slide stops it. Some videos cannot be embedded because their owners restrict playback. Linked images and videos need internet access and are not downloaded with the speech audio.

Existing talks need no changes. Slides do not alter speech text, delivery presets, or cached audio. Saving a slide creates a version in History. Restoring a version restores its slides too, including versions from before slides were added. Unchanged sections retain their slides after text editing. Rewritten sections and changed paragraph or sentence splits need their slides assigned again.

## Implementation

The optional `slide` field lives on each segment, so existing version snapshots and offline document copies retain it. Sections sharing a slide carry the same slide ID and content. The authenticated `talks.saveSectionSlide` mutation updates every occurrence of that ID in one transaction and snapshots the previous state. Removing an attachment affects only the selected section.

Slide-only saves replace the cached document without invalidating audio or its prepared status. Audio identity excludes slide content. Remote media is loaded only in the editor preview or audience window.

Deploy the updated Convex schema and functions together with the frontend. No migration is needed for existing talks.

YouTube embeds follow the [official player documentation](https://developers.google.com/youtube/player_parameters). Podium extracts a video ID from supported YouTube links and creates a fixed embed URL. It does not embed arbitrary supplied URLs or HTML.
