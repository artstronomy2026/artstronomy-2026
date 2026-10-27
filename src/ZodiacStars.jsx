import { useEffect, useRef, useState } from "react";

// These are graphic paths for the exhibition, rather than astronomical star maps.
const shapes = [
  [[.15,.70],[.34,.51],[.21,.29],[.49,.35],[.66,.17],[.83,.30],[.69,.55],[.85,.77]],
  [[.13,.37],[.35,.18],[.51,.33],[.79,.17],[.65,.47],[.85,.68],[.54,.78],[.32,.61]],
  [[.22,.17],[.28,.44],[.19,.75],[.44,.59],[.55,.19],[.62,.46],[.82,.74],[.62,.83]],
  [[.15,.30],[.37,.17],[.49,.41],[.79,.22],[.64,.58],[.85,.78],[.49,.72],[.27,.83]],
  [[.15,.55],[.32,.25],[.57,.17],[.81,.34],[.66,.52],[.84,.78],[.49,.69],[.23,.80]],
  [[.16,.19],[.36,.40],[.59,.21],[.81,.35],[.62,.58],[.77,.81],[.42,.72],[.24,.84]],
  [[.16,.20],[.31,.52],[.54,.29],[.81,.22],[.71,.58],[.83,.81],[.48,.76],[.26,.70]],
  [[.15,.68],[.38,.80],[.55,.52],[.37,.31],[.61,.18],[.82,.38],[.68,.72],[.85,.82]],
  [[.15,.79],[.39,.59],[.31,.29],[.61,.19],[.81,.38],[.58,.51],[.71,.75],[.86,.83]],
  [[.15,.28],[.36,.18],[.53,.40],[.77,.22],[.69,.53],[.82,.75],[.52,.83],[.28,.69]],
  [[.16,.42],[.37,.21],[.57,.42],[.82,.19],[.68,.58],[.83,.81],[.53,.70],[.28,.82]],
  [[.14,.28],[.39,.17],[.54,.39],[.82,.29],[.67,.62],[.81,.81],[.45,.77],[.25,.58]],
];

export const zodiacSigns = [
  ["Aries", "♈"], ["Taurus", "♉"], ["Gemini", "♊"], ["Cancer", "♋"],
  ["Leo", "♌"], ["Virgo", "♍"], ["Libra", "♎"], ["Scorpio", "♏"],
  ["Sagittarius", "♐"], ["Capricorn", "♑"], ["Aquarius", "♒"], ["Pisces", "♓"],
];

const seededStars = Array.from({ length: 145 }, (_, index) => ({
  x: ((index * 127.1 + 19.7) % 997) / 997,
  y: ((index * 319.7 + 47.3) % 991) / 991,
  size: 0.6 + (index % 9) * 0.16,
  phase: index * 1.79,
}));

function loadSharedStars() {
  try { return Math.min(160, Math.max(0, Number(localStorage.getItem("artstronomy-zodiac-stars") || 0))); }
  catch { return 0; }
}

function addSharedStar() {
  const next = Math.min(160, loadSharedStars() + 1);
  try { localStorage.setItem("artstronomy-zodiac-stars", String(next)); } catch { /* Local storage may be disabled. */ }
  return next;
}

export function ZodiacStars({ videoRef, stream, mirrored, onSave }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cardsRef = useRef([]);
  const handRef = useRef({ x: 0, y: 0, visible: false, lastSeen: 0 });
  const motionRef = useRef({ previous: null, distance: 0 });
  const holdRef = useRef({ index: -1, since: 0 });
  const trailRef = useRef([]);
  const stageRef = useRef("choose");
  const signRef = useRef(4);
  const progressRef = useRef(0);
  const [stage, setStage] = useState("choose");
  const [signIndex, setSignIndex] = useState(4);
  const [progress, setProgress] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [holdAmount, setHoldAmount] = useState(0);
  const [handVisible, setHandVisible] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState("Starting hand tracking…");
  const [sharedStars, setSharedStars] = useState(loadSharedStars);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { signRef.current = signIndex; }, [signIndex]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  const selectSign = (index) => {
    signRef.current = index;
    progressRef.current = 0;
    stageRef.current = "draw";
    motionRef.current = { previous: null, distance: 0 };
    holdRef.current = { index: -1, since: 0 };
    setSignIndex(index);
    setProgress(0);
    setHoveredIndex(-1);
    setHoldAmount(0);
    setStage("draw");
  };

  const reset = () => {
    stageRef.current = "choose";
    progressRef.current = 0;
    motionRef.current = { previous: null, distance: 0 };
    setProgress(0);
    setStage("choose");
  };

  const advance = () => {
    const next = Math.min(shapes[signRef.current].length - 1, progressRef.current + 1);
    if (next === progressRef.current) return;
    progressRef.current = next;
    setProgress(next);
    if (next === shapes[signRef.current].length - 1) {
      stageRef.current = "reveal";
      setSharedStars(addSharedStar());
      setStage("reveal");
    }
  };

  const moveHand = (x, y, now) => {
    const hand = handRef.current;
    const wasVisible = hand.visible;
    const previousX = hand.x;
    const previousY = hand.y;
    hand.x = wasVisible ? previousX + (x - previousX) * .48 : x;
    hand.y = wasVisible ? previousY + (y - previousY) * .48 : y;
    hand.visible = true;
    hand.lastSeen = now;
    if (!wasVisible) setHandVisible(true);

    if (stageRef.current === "choose") {
      const sceneRect = sceneRef.current?.getBoundingClientRect();
      const card = cardsRef.current.findIndex((element) => {
        if (!element || !sceneRect) return false;
        const rect = element.getBoundingClientRect();
        const screenX = sceneRect.left + hand.x;
        const screenY = sceneRect.top + hand.y;
        return screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom;
      });
      if (card !== holdRef.current.index) {
        holdRef.current = { index: card, since: now };
        setHoveredIndex(card);
      }
      if (card >= 0) {
        const amount = Math.min(1, (now - holdRef.current.since) / 1200);
        setHoldAmount(amount);
        if (amount >= 1) selectSign(card);
      } else setHoldAmount(0);
    } else if (stageRef.current === "draw") {
      const motion = motionRef.current;
      if (motion.previous) {
        const distance = Math.hypot(hand.x - motion.previous.x, hand.y - motion.previous.y);
        if (distance < 170) motion.distance += distance;
        if (motion.distance >= Math.max(48, Math.min(sceneRef.current?.clientWidth || 600, sceneRef.current?.clientHeight || 600) * .11)) {
          motion.distance = 0;
          advance();
        }
      }
      motion.previous = { x: hand.x, y: hand.y };
    }
  };

  useEffect(() => {
    let cancelled = false;
    let animation = 0;
    let landmarker;
    let lastDetection = 0;
    let lastVideoTime = -1;
    (async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        if (cancelled) return;
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate: "CPU" },
          runningMode: "VIDEO", numHands: 1,
          minHandDetectionConfidence: .55, minTrackingConfidence: .5,
        });
        if (cancelled) { landmarker.close(); return; }
        setTrackingStatus("Raise your hand to begin");
        const detect = (now) => {
          if (cancelled) return;
          const video = videoRef.current;
          const scene = sceneRef.current;
          if (video?.readyState >= 2 && scene && now - lastDetection > 72 && video.currentTime !== lastVideoTime) {
            lastDetection = now;
            lastVideoTime = video.currentTime;
            try {
              const result = landmarker.detectForVideo(video, now);
              const tip = result.landmarks?.[0]?.[8];
              if (tip) {
                const vw = video.videoWidth || scene.clientWidth;
                const vh = video.videoHeight || scene.clientHeight;
                const w = scene.clientWidth;
                const h = scene.clientHeight;
                const scale = Math.max(w / vw, h / vh);
                const x = ((mirrored ? 1 - tip.x : tip.x) * vw * scale) - (vw * scale - w) / 2;
                const y = (tip.y * vh * scale) - (vh * scale - h) / 2;
                moveHand(Math.max(0, Math.min(w, x)), Math.max(0, Math.min(h, y)), now);
              } else if (now - handRef.current.lastSeen > 380 && handRef.current.visible) {
                handRef.current.visible = false;
                motionRef.current.previous = null;
                holdRef.current = { index: -1, since: 0 };
                setHandVisible(false);
                setHoveredIndex(-1);
                setHoldAmount(0);
              }
            } catch { setTrackingStatus("Hand tracking paused. Tap a sign to continue."); }
          }
          animation = requestAnimationFrame(detect);
        };
        animation = requestAnimationFrame(detect);
      } catch {
        if (!cancelled) setTrackingStatus("Hand tracking unavailable. Tap or click to explore.");
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(animation); landmarker?.close(); };
  }, [videoRef, stream, mirrored]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    let animation = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(scene.clientWidth * dpr);
      canvas.height = Math.round(scene.clientHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(scene);
    resize();

    const render = (now) => {
      const w = scene.clientWidth;
      const h = scene.clientHeight;
      const ctx = context;
      const bg = ctx.createRadialGradient(w * .52, h * .48, 1, w * .5, h * .5, Math.max(w, h) * .75);
      bg.addColorStop(0, "#161f30");
      bg.addColorStop(.55, "#161f30");
      bg.addColorStop(1, "#0b1220");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const count = Math.min(seededStars.length, 70 + sharedStars);
      for (let index = 0; index < count; index++) {
        const star = seededStars[index];
        const alpha = .18 + .52 * (.5 + .5 * Math.sin(now * .0014 + star.phase));
        ctx.fillStyle = `rgba(245,234,191,${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (stageRef.current !== "choose") {
        const points = shapes[signRef.current];
        const mobile = w < 700;
        const left = mobile ? w * .14 : w * .27;
        const top = mobile ? h * .22 : h * .16;
        const width = mobile ? w * .72 : w * .46;
        const height = mobile ? h * .43 : h * .66;
        const plotted = points.map(([px, py]) => [left + px * width, top + py * height]);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = stageRef.current === "reveal" ? 2.8 : 2;
        ctx.strokeStyle = "rgba(255,224,116,.9)";
        ctx.shadowColor = "#ffd400";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        plotted.slice(0, progressRef.current + 1).forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
        ctx.shadowBlur = 0;
        plotted.forEach(([x, y], index) => {
          const lit = index <= progressRef.current;
          ctx.fillStyle = lit ? "#fffef6" : "rgba(240,231,191,.43)";
          ctx.shadowColor = lit ? "#ffd400" : "transparent";
          ctx.shadowBlur = lit ? 22 : 0;
          ctx.beginPath(); ctx.arc(x, y, lit ? 5 : 3, 0, Math.PI * 2); ctx.fill();
        });
        ctx.shadowBlur = 0;
        if (stageRef.current === "reveal") {
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,226,125,.14)";
          ctx.font = `${Math.min(w * .43, h * .55)}px "Poppins", sans-serif`;
          ctx.fillText(zodiacSigns[signRef.current][1], w / 2, h * .7);
          ctx.fillStyle = "#ffd400";
          ctx.font = `700 ${Math.min(40, Math.max(22, w * .04))}px "Poppins", sans-serif`;
          ctx.fillText(`You awakened ${zodiacSigns[signRef.current][0]}`, w / 2, mobile ? h * .77 : h * .86);
        }
      }

      const hand = handRef.current;
      if (hand.visible) {
        trailRef.current.push({ x: hand.x, y: hand.y, life: 1 });
        if (trailRef.current.length > 28) trailRef.current.shift();
      }
      trailRef.current = trailRef.current.filter((particle) => particle.life > .03);
      trailRef.current.forEach((particle) => {
        ctx.fillStyle = `rgba(255,226,129,${particle.life * .65})`;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.life * 5, 0, Math.PI * 2); ctx.fill();
        particle.life *= .91;
      });
      if (hand.visible) {
        ctx.strokeStyle = "#ffd400";
        ctx.shadowColor = "#ffd400";
        ctx.shadowBlur = 24;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hand.x, hand.y, 15 + Math.sin(now * .008) * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(hand.x, hand.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animation); observer.disconnect(); };
  }, [sharedStars]);

  const movePointer = (event) => {
    if (event.pointerType === "touch" && event.type !== "pointerdown" && event.buttons === 0) return;
    if (stageRef.current !== "draw") return;
    const rect = sceneRef.current.getBoundingClientRect();
    moveHand(event.clientX - rect.left, event.clientY - rect.top, performance.now());
  };

  return (
    <div ref={sceneRef} className="zodiac-experience" aria-label="Zodiac Star Weaver">
      <canvas ref={canvasRef} className="zodiac-experience__canvas" aria-hidden="true" />
      <div className="zodiac-experience__input" onPointerDown={movePointer} onPointerMove={movePointer} />
      <div className="zodiac-experience__heading">
        <img className="zodiac-experience__mascot" src="/assets/hoshi-mascot.webp" alt="Hoshi" />
        <span className="zodiac-experience__eyebrow">ARTSTRONOMY · STAR WEAVER</span>
        <h2>{stage === "choose" ? "Wake the stars" : stage === "draw" ? `Draw ${zodiacSigns[signIndex][0]}` : "Your constellation"}</h2>
        <p>{stage === "choose" ? "Raise your hand, then hold over a zodiac sign to choose it." : stage === "draw" ? "Wave your hand to connect the stars." : "Your star is now part of our exhibition sky."}</p>
      </div>
      {stage === "choose" && (
        <div className="zodiac-experience__grid" aria-label="Choose a zodiac sign">
          {zodiacSigns.map(([name, symbol], index) => (
            <button key={name} ref={(element) => { cardsRef.current[index] = element; }} type="button" className={hoveredIndex === index ? "is-hovered" : ""} style={{ "--hold": hoveredIndex === index ? `${holdAmount * 100}%` : "0%" }} onClick={() => selectSign(index)} aria-label={`Choose ${name}`}>
              <span aria-hidden="true">{symbol}</span><strong>{name}</strong>
            </button>
          ))}
        </div>
      )}
      {stage === "draw" && (
        <div className="zodiac-experience__bottom">
          <span>{progress + 1} / {shapes[signIndex].length} stars connected</span>
          <div className="zodiac-experience__progress" role="progressbar" aria-valuenow={progress + 1} aria-valuemin={1} aria-valuemax={shapes[signIndex].length} aria-label="Constellation progress"><i style={{ width: `${(progress + 1) / shapes[signIndex].length * 100}%` }} /></div>
          <button type="button" onClick={advance}>Connect next star</button>
        </div>
      )}
      {stage === "reveal" && (
        <div className="zodiac-experience__bottom zodiac-experience__bottom--reveal">
          <p>Take a photo of the screen or save your star image.</p>
          <button type="button" onClick={() => onSave(canvasRef.current, zodiacSigns[signIndex][0])}>Save image</button>
          <button type="button" onClick={reset}>Choose another sign</button>
        </div>
      )}
      <span className="zodiac-experience__status" role="status">{handVisible ? "Hand detected · move to explore" : trackingStatus}</span>
      {stage !== "choose" && stage !== "reveal" && <button className="zodiac-experience__back" type="button" onClick={reset}>Change sign</button>}
    </div>
  );
}
