# ARTStronomy Virtual Gallery

An independent, client-side exhibition built into the existing Camera dialog.
No hosted gallery account or subscription. A VR headset is optional.

- `VirtualGallery.jsx`: responsive controls, creator directory and exhibit details.
- `gallery-engine.js`: Three.js room, navigation, raycast selection, device orientation, handheld AR and optional headset VR.
- `css-gallery-renderer.js`: same scene projected with CSS 3D when WebGL cannot start.
- `gallery-layout.js`: exhibit positions, viewing stops and room boundaries.
- `virtual-gallery.css`: scoped mobile/tablet/desktop presentation.

Content comes from `src/cosmic/creators.js`. The existing images are category artwork,
not verified individual projects. Both wall plaques and details say so. Replace
these only when real project content is provided.

## Glass-roof observatory

Eight decorative planets slowly orbit above the glass roof; the installation is not to scale. Reduced motion freezes the solar system. Walk speed is 4.2 m/s. The far end offers the existing website or Keep exploring. The compact 22 creators selector replaces the old large information bar; details are contextual instead of modal. The CSS fallback shows simplified planet surfaces without the WebGL lighting or rings.

## Visitor controls

Open AR → Virtual Gallery. Drag to look; hold the directional pad to move. A visitor
can also select an exhibitor or use Previous / Next to travel to their wall display.
Hover, gaze at or tap a frame to show contextual creator details beside it. The Details button pins the selected creator. Keyboard users can focus the 3D
view and use W/A/S/D or arrow keys, and Enter to inspect the artwork in front.
Directional buttons also work with keyboard activation. Entrance returns to the
start. Reduced-motion preferences make exhibit travel instantaneous.

Move phone to look requests orientation permission from the button click where
required. Device orientation changes the view direction, not physical position;
the pad still handles travel. Touch stays available if sensors are unavailable,
permission is denied, or no readings arrive. Dragging returns to touch-look mode.

Walk-in AR is shown only on touch devices reporting `immersive-ar` support and a
working WebGL renderer. The session requires a DOM overlay to keep Exit AR and
exhibit navigation available. Framed exhibits appear at full scale in camera
space; the virtual architecture is hidden to preserve the real-world view. A
local viewer pose anchors the gallery at eye height. Physical device movement
updates the viewpoint. Next/Previous reanchors the selected exhibit in front of
the visitor without requiring them to cross the virtual room's full length.
No floor/surface detection is claimed. Lost tracking hides the objects and shows
recovery instructions. Browser rejection returns to touch navigation.

The webcam is stopped on switching from the scanner/Hoshi into the gallery.
Closing or switching tabs disposes textures, geometry, render loops, listeners,
resize observers, sensor access and any XR session. Other site 3D models pause
while the camera dialog is open.

## Validation

`node --test tests/gallery-layout.test.mjs` checks the complete real roster,
unique/reachable exhibit locations, viewing direction, wraparound and boundaries.
Build and worker tests use the site's existing npm commands. The cloud preview
has WebGL disabled; the functioning CSS 3D path, selection, navigation, mobile
layout, Escape and sensor-unavailable fallback were checked there. Physical
orientation and handheld AR require a real device test on the HTTPS site.

Mobile navigation: tap the visible floor to walk to that point, or tap an artwork to approach its viewing stop. Drag to look. Multi-touch does not zoom or walk. Floor taps outside the room are ignored; blur cancels travel. Device orientation is recalibrated on arrival.

## Optional headset view

Open the spaceship or museum, then choose **Enter VR** when the browser reports
`immersive-vr` support. Detection refreshes when XR devices change. Unsupported
browsers keep the normal experience without a VR prompt. The browser requires
an explicit action to enter VR; hardware capability alone never starts it.

This first headset version needs no controllers, hand tracking or floor tracking.
It uses a local reference space, suitable for seated, rotation-only viewing.
Look down at a button and hold the centre reticle there for 1.6 seconds to select.
The cockpit offers recenter and exit; the museum offers previous/next creator,
atrium and exit. Museum travel teleports rather than driving the headset camera.
Look away before selecting the same button again. Phone walk-in AR is separate
and retains its existing DOM overlay and controls.

The user's DPVR E3-C Lite requires its PC headset software to expose a compatible
VR runtime to the browser. This is browser/runtime detection, not Bluetooth
pairing. No headset driver is installed by this website. Physical DPVR operation,
stereo comfort and frame rate must be checked on the user's headset; automated
tests cover capability changes, dwell, pose alignment, errors and cleanup.
