import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ARCameraFallback as SplitARCamera,
} from "./ARExperience.jsx";
import { creatorData } from "./cosmic/creators.js";
import { HoverExpand } from "./HoverExpand.jsx";
import ConstellationGame from "./constellation/ConstellationGame.jsx";
import { creatorsForOrbit } from "./constellation/game-model.js";
import {useJourney} from "./journey/useJourney.js";
import {JourneyOverlay} from "./journey/JourneyOverlay.jsx";
import {CinematicIntro} from "./loading/CinematicIntro.jsx";
import {shouldShowIntro} from "./loading/intro-model.js";
import StaggeredMenu from "./components/StaggeredMenu.jsx";

const HoshiModel = lazy(() => import("./HoshiModel.jsx").then((module) => ({ default: module.HoshiModel })));

const instagramUrl = "https://www.instagram.com/artstronomy_2026?utm_source=ig_web_button_share_sheet&igsi=ZDNlZDc0MzIxNw==";

const menuItems = [
  { label: "Home", ariaLabel: "Go to the ARTStronomy home section", link: "#top" },
  { label: "About", ariaLabel: "Learn about the ARTStronomy exhibition", link: "#about" },
  { label: "Disciplines", ariaLabel: "Explore the exhibition disciplines", link: "#disciplines" },
  { label: "Creators", ariaLabel: "Meet the 22 ARTStronomy creators", link: "#creators" },
  { label: "Day Event", ariaLabel: "View the exhibition day programme", link: "#day-events" },
  { label: "Contact", ariaLabel: "Find exhibition updates and contact information", link: "#visit" },
];

const socialItems = [{ label: "Instagram · @artstronomy_2026", link: instagramUrl }];

const dayEvents = [
  {
    number: "01",
    category: "Welcome Session",
    title: "Opening Orbit",
    description:
      "Start the exhibition day inside the ARTStronomy universe, discover the showcase format, and meet the 22 final-year creators behind the work.",
    image: "/assets/project-graphic-design.webp",
  },
  {
    number: "02",
    category: "Creator Programme",
    title: "Meet the Makers",
    description:
      "Explore branding, advertising, publishing, and web design projects while hearing directly from the Graphic Design & Multimedia creators.",
    image: "/assets/project-web-publishing.webp",
  },
  {
    number: "03",
    category: "Screening & Showcase",
    title: "Animation Afterglow",
    description:
      "Close the programme with 2D, 3D, and mixed-media animation work from the Digital Animation creators, presented as one final shared showcase.",
    image: "/assets/project-animation.webp",
  },
];



const creatorCategories = [...new Set(creatorData.map((creator) => creator.category))];

function HoshiFallback({ label }) {
  return (
    <div className="hoshi-model" role="img" aria-label={label}>
      <img className="hoshi-model-fallback" src="/assets/hoshi-mascot.webp" alt="" decoding="async" />
    </div>
  );
}

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.14 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Marquee() {
  const sectionRef = useRef(null);
  const topRowRef = useRef(null);
  const bottomRowRef = useRef(null);
  const tiles = [
    "/assets/hoshi-poster.webp",
    ...dayEvents.map((event) => event.image),
    "/assets/project-animation.webp",
    "/assets/project-graphic-design.webp",
  ];

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const offset = (window.innerHeight - rect.top) * 0.16;
      if (topRowRef.current) topRowRef.current.style.transform = `translate3d(${-260 + offset}px,0,0)`;
      if (bottomRowRef.current) bottomRowRef.current.style.transform = `translate3d(${-offset}px,0,0)`;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section className="marquee-section" ref={sectionRef} aria-label="Exhibition day event preview">
      <div className="marquee-row" ref={topRowRef} style={{ transform: "translate3d(-260px,0,0)" }}>
        {[...tiles, ...tiles].map((src, index) => (
          <img key={`top-${index}`} src={src} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="marquee-row" ref={bottomRowRef} style={{ transform: "translate3d(0,0,0)" }}>
        {[...tiles.slice().reverse(), ...tiles.slice().reverse()].map((src, index) => (
          <img key={`bottom-${index}`} src={src} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
    </section>
  );
}

function CreatorIndex() {
  const [filter, setFilter] = useState("all");
  const [creatorSelection, setCreatorSelection] = useState(null);
  const creators = useMemo(
    () => filter === "all" ? creatorData : creatorsForOrbit(creatorData, filter),
    [filter],
  );

  return (
    <section className="creator-section" id="creators">
      <Reveal className="section-heading-row">
        <p className="eyebrow">The creator constellation</p>
        <h2>22 minds<br />in orbit.</h2>
      </Reveal>
      <div className="creator-toolbar" aria-label="Filter creators by category">
        {["all", "Animation", ...creatorCategories].map((value) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? `All ${creatorData.length}` : `${value} ${creatorsForOrbit(creatorData,value).length}`}
          </button>
        ))}
      </div>
      <HoverExpand items={creators} selection={creatorSelection} />
      <ConstellationGame />
    </section>
  );
}

function EventDialog({ event, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="event-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={onClose} autoFocus>
          Close
        </button>
        <img src={event.image} alt="" decoding="async" />
        <div>
          <p className="eyebrow">{event.category}</p>
          <h3 id="dialog-title">{event.title}</h3>
          <p>{event.description}</p>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [isOpening, setIsOpening] = useState(() => {
    try { return shouldShowIntro(window.sessionStorage, window.location.hash); } catch { return true; }
  });
  const [hubReady,setHubReady]=useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRequestedRef = useRef(false);
  const [websiteReveal,setWebsiteReveal]=useState(null);
  const shipReturn=useJourney({onMode:next=>{if(next==='station'){cameraRequestedRef.current=true;setCameraOpen(true);}},onDone:()=>{}});
  useEffect(()=>{if(!websiteReveal)return;const timer=setTimeout(()=>setWebsiteReveal(null),websiteReveal.duration);return()=>clearTimeout(timer);},[websiteReveal]);
  const [arPending, setArPending] = useState(false);
  const [arError, setArError] = useState("");
  const heroModelRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraFacingRef = useRef("environment");

  const requestCamera = async (facingMode = cameraFacingRef.current) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
    const video = {
      facingMode: { exact: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch {
      return navigator.mediaDevices.getUserMedia({
        video: { ...video, facingMode: { ideal: facingMode } },
        audio: false,
      });
    }
  };

  const restartCamera = async (facingMode = cameraFacingRef.current) => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    const stream = await requestCamera(facingMode);
    if (!cameraRequestedRef.current) { stream.getTracks().forEach(track => track.stop()); return null; }
    cameraFacingRef.current = facingMode;
    cameraStreamRef.current = stream;
    setCameraStream(stream);
    return stream;
  };

  const closeCamera = () => {
    window.scrollTo({top:0,behavior:"instant"});
    setWebsiteReveal({kind:"reveal",to:"website",duration:550,started:performance.now()});
    cameraRequestedRef.current = false;
    setCameraOpen(false);
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
  };

  const pauseCameraForGallery = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
  };

  const openAR = () => {
    if(arPending||shipReturn.isActive())return;
    document.documentElement.style.setProperty('--launch-origin-y',`${window.scrollY+window.innerHeight/2}px`);
    setArError('');shipReturn.begin('website','station');
  };


  return (
    <>
      {isOpening && <CinematicIntro onComplete={()=>setIsOpening(false)}/>}
      <main inert={isOpening?true:undefined} className={shipReturn.phase?.kind==='portal'?"website-departure":""}>
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials
        displayItemNumbering
        menuButtonColor="#fffef6"
        openMenuButtonColor="#fffef6"
        changeMenuColorOnOpen
        colors={["#3e7bef", "#56c6b5", "#ffd400"]}
        logoUrl="/assets/artstronomy-wordmark.svg"
        accentColor="#ffd400"
        isFixed={true}
        closeOnClickAway={true}
      />
      <section className="hero" id="top">
        <div className="hero-title-wrap">
          <div className="institution-logos" aria-label="Universiti Tunku Abdul Rahman, Faculty of Creative Industries">
            <img className="institution-logo institution-logo--utar" src="/assets/utar-logo.png" alt="UTAR — Universiti Tunku Abdul Rahman" width="338" height="170" />
            <img className="institution-logo institution-logo--fci" src="/assets/fci-logo.png" alt="Faculty of Creative Industries" width="400" height="460" />
          </div>
          <h1 tabIndex={-1}><img className="hero-wordmark" src="/assets/artstronomy-wordmark.svg" alt="ARTStronomy" width="1318" height="316" fetchPriority="high" /></h1>
        </div>

        <div className="mascot-stage">
          <Suspense fallback={<HoshiFallback label="Hoshi, ARTStronomy's star mascot" />}>
            <HoshiModel
              ref={heroModelRef}
              enabled={!cameraOpen}
              label="Interactive 3D model of Hoshi, ARTStronomy's star mascot"
            />
          </Suspense>
          <span className="model-gesture-hint" aria-hidden="true">Swipe Hoshi to rotate 360°</span>
        </div>

        <div className="hero-bottom">
          <p>
            22 final-year creators bringing branding, advertising, publishing, web design, and animation into one expanding universe.
          </p>
          <div className="hero-ar-action">
            <button className="outline-button" type="button" onClick={() => heroModelRef.current?.wave()}>Wave hello</button>
            <button className="primary-button" type="button" onClick={openAR} disabled={arPending} aria-busy={arPending}>
              Enter spaceship
            </button>
            {arError && <span className="ar-error" role="status">{arError}</span>}
          </div>
        </div>
      </section>

      <Marquee />

      <section className="about" id="about">
        <img className="about-poster" src="/assets/hoshi-poster.webp" alt="Original Hoshi mascot poster" loading="lazy" decoding="async" />
        <Reveal className="about-copy">
          <p className="eyebrow">A star is born</p>
          <h2>22 creative<br />worlds collide.</h2>
          <p className="about-body">
            ARTStronomy is the collective final-year exhibition of arts and design students from Universiti Tunku Abdul Rahman, Sungai Long. It brings together 18 Graphic Design & Multimedia students and 4 Digital Animation students under one playful creative universe.
          </p>
          <a className="outline-button" href="#disciplines">Explore the disciplines</a>
        </Reveal>
      </section>

      <section className="disciplines" id="disciplines">
        <Reveal>
          <p className="eyebrow dark">Two departments · one exhibition</p>
          <h2>Disciplines</h2>
        </Reveal>
        <div className="discipline-list">
          <Reveal className="discipline-item">
            <span className="discipline-number">01</span>
            <div>
              <div className="discipline-title-row">
                <h3>Graphic Design & Multimedia</h3>
                <strong>18 creators</strong>
              </div>
              <p>Branding · Advertising · Publishing · Web Design</p>
            </div>
          </Reveal>
          <Reveal className="discipline-item" delay={100}>
            <span className="discipline-number">02</span>
            <div>
              <div className="discipline-title-row">
                <h3>Digital Animation</h3>
                <strong>4 creators</strong>
              </div>
              <p>2D Animation · 3D Animation · Mix Media · Motion Graphic</p>
            </div>
          </Reveal>
        </div>
      </section>

      <CreatorIndex />

      <section className="day-events" id="day-events">
        <Reveal>
          <p className="eyebrow">18–20 December 2026 · 11 AM–8 PM daily · GMBB Level 5</p>
          <h2>Day Event</h2>
        </Reveal>
        <div className="event-stack">
          {dayEvents.map((event, index) => (
            <article className="event-card" key={event.number} style={{ top: `${80 + index * 22}px` }}>
              <div className="event-meta">
                <span className="event-number">{event.number}</span>
                <div>
                  <p>{event.category}</p>
                  <h3>{event.title}</h3>
                </div>
                <button type="button" onClick={() => setSelectedEvent(event)}>View details</button>
              </div>
              <img src={event.image} alt={`Artwork for ${event.title} event`} loading="lazy" decoding="async" />
            </article>
          ))}
        </div>
      </section>

      <section className="visit" id="visit">
        <div className="visit-model">
          <Suspense fallback={<HoshiFallback label="Hoshi, ARTStronomy's star mascot" />}>
            <HoshiModel defer enabled={!cameraOpen} label="Interactive 3D model of Hoshi" />
          </Suspense>
        </div>
        <div>
          <p className="eyebrow dark">Exhibition details</p>
          <h2>Come meet<br />our universe.</h2>
          <div className="visit-details" aria-label="ARTStronomy exhibition date and venue">
            <div>
              <span>Day Event</span>
              <strong>18–20 December 2026</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>11:00 AM–8:00 PM · Daily</strong>
            </div>
            <div>
              <span>Venue</span>
              <strong>GMBB · Level 5</strong>
            </div>
          </div>
          <p>Meet all 22 final-year creators and explore graphic design, multimedia, and animation work across three exhibition days.</p>
          <a className="dark-button" href={instagramUrl} target="_blank" rel="noreferrer">Follow exhibition updates</a>
        </div>
      </section>

      <section className="website-ship-return" aria-label="Return to the spaceship"><p>Ready for another journey?</p><button type="button" onClick={openAR}>Return to spaceship</button></section>
      <footer>
        <strong>ARTStronomy</strong>
        <a href={instagramUrl} target="_blank" rel="noreferrer">@artstronomy_2026</a>
      </footer>

      {selectedEvent && <EventDialog event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      {cameraOpen && (
        <SplitARCamera
          introBlocked={isOpening}
          onHubReady={setHubReady}
          arrivalPhase={shipReturn.phase}
          stream={cameraStream}
          onClose={closeCamera}
          onRestartCamera={restartCamera}
          onPauseCamera={pauseCameraForGallery}
        />
      )}
      </main>
      <JourneyOverlay phase={shipReturn.phase||websiteReveal}/>
    </>
  );
}
