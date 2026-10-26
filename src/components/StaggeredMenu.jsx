import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import "./StaggeredMenu.css";
import { useNavigationContrast } from "./useNavigationContrast.js";

export const StaggeredMenu = ({
  position = "right",
  colors = ["#3e7bef", "#56c6b5", "#ffd400"],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className,
  logoUrl = "/assets/artstronomy-wordmark.svg",
  menuButtonColor = "#fffef6",
  openMenuButtonColor = "#fffef6",
  accentColor = "#ffd400",
  changeMenuColorOnOpen = true,
  isFixed = false,
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
}) => {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef(null);
  const preLayersRef = useRef(null);
  const preLayerElsRef = useRef([]);
  const plusHRef = useRef(null);
  const plusVRef = useRef(null);
  const iconRef = useRef(null);
  const textInnerRef = useRef(null);
  const [textLines, setTextLines] = useState(["Menu", "Close"]);
  const openTlRef = useRef(null);
  const closeTweenRef = useRef(null);
  const spinTweenRef = useRef(null);
  const textCycleAnimRef = useRef(null);
  const headerRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const busyRef = useRef(false);
  const itemEntranceTweenRef = useRef(null);
  useNavigationContrast(headerRef, panelRef, open);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;
      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      const preLayers = preContainer
        ? Array.from(preContainer.querySelectorAll(".sm-prelayer"))
        : [];
      preLayerElsRef.current = preLayers;
      const offscreen = position === "left" ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      gsap.set(plusH, { transformOrigin: "50% 50%", rotate: 0 });
      gsap.set(plusV, { transformOrigin: "50% 50%", rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      gsap.set(textInner, { yPercent: 0 });

    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    closeTweenRef.current?.kill();
    itemEntranceTweenRef.current?.kill();
    const itemEls = Array.from(panel.querySelectorAll(".sm-panel-itemLabel"));
    const numberEls = Array.from(panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item"));
    const socialTitle = panel.querySelector(".sm-socials-title");
    const socialLinks = Array.from(panel.querySelectorAll(".sm-socials-link"));
    const offscreen = position === "left" ? -100 : 100;

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const timeline = gsap.timeline({ paused: true });
    layers.forEach((layer, index) => {
      timeline.fromTo(
        layer,
        { xPercent: offscreen },
        { xPercent: 0, duration: 0.5, ease: "power4.out" },
        index * 0.07,
      );
    });
    const lastLayerTime = layers.length ? (layers.length - 1) * 0.07 : 0;
    const panelStart = lastLayerTime + (layers.length ? 0.08 : 0);
    timeline.fromTo(
      panel,
      { xPercent: offscreen },
      { xPercent: 0, duration: 0.65, ease: "power4.out" },
      panelStart,
    );

    const itemsStart = panelStart + 0.1;
    if (itemEls.length) {
      timeline.to(itemEls, {
        yPercent: 0,
        rotate: 0,
        duration: 0.9,
        ease: "power4.out",
        stagger: { each: 0.075, from: "start" },
      }, itemsStart);
    }
    if (numberEls.length) {
      timeline.to(numberEls, {
        duration: 0.55,
        ease: "power2.out",
        "--sm-num-opacity": 1,
        stagger: { each: 0.065, from: "start" },
      }, itemsStart + 0.08);
    }
    const socialsStart = panelStart + 0.3;
    if (socialTitle) timeline.to(socialTitle, { opacity: 1, duration: 0.45 }, socialsStart);
    if (socialLinks.length) {
      timeline.to(socialLinks, {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.08,
        onComplete: () => gsap.set(socialLinks, { clearProps: "opacity" }),
      }, socialsStart + 0.04);
    }
    openTlRef.current = timeline;
    return timeline;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const timeline = buildOpenTimeline();
    if (!timeline) {
      busyRef.current = false;
      return;
    }
    timeline.eventCallback("onComplete", () => { busyRef.current = false; });
    timeline.play(0);
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    itemEntranceTweenRef.current?.kill();
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;
    closeTweenRef.current?.kill();
    const offscreen = position === "left" ? -100 : 100;
    closeTweenRef.current = gsap.to([...layers, panel], {
      xPercent: offscreen,
      duration: 0.32,
      ease: "power3.in",
      overwrite: "auto",
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll(".sm-panel-itemLabel"));
        const numberEls = Array.from(panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item"));
        const socialTitle = panel.querySelector(".sm-socials-title");
        const socialLinks = Array.from(panel.querySelectorAll(".sm-socials-link"));
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busyRef.current = false;
      },
    });
  }, [position]);

  const animateIcon = useCallback((opening) => {
    spinTweenRef.current?.kill();
    if (!iconRef.current) return;
    spinTweenRef.current = gsap.to(iconRef.current, {
      rotate: opening ? 225 : 0,
      duration: opening ? 0.8 : 0.35,
      ease: opening ? "power4.out" : "power3.inOut",
      overwrite: "auto",
    });
  }, []);

  const animateText = useCallback((opening) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();
    const currentLabel = opening ? "Menu" : "Close";
    const targetLabel = opening ? "Close" : "Menu";
    const sequence = [currentLabel];
    let last = currentLabel;
    for (let index = 0; index < 3; index += 1) {
      last = last === "Menu" ? "Close" : "Menu";
      sequence.push(last);
    }
    if (last !== targetLabel) sequence.push(targetLabel);
    sequence.push(targetLabel);
    setTextLines(sequence);
    gsap.set(inner, { yPercent: 0 });
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -((sequence.length - 1) / sequence.length) * 100,
      duration: 0.5 + sequence.length * 0.07,
      ease: "power4.out",
    });
  }, []);

  const closeMenu = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    onMenuClose?.();
    playClose();
    animateIcon(false);
    animateText(false);
  }, [animateIcon, animateText, onMenuClose, playClose]);

  const toggleMenu = useCallback(() => {
    if (openRef.current) {
      closeMenu();
      return;
    }
    openRef.current = true;
    setOpen(true);
    onMenuOpen?.();
    playOpen();
    animateIcon(true);
    animateText(true);
  }, [animateIcon, animateText, closeMenu, onMenuOpen, playOpen]);

  React.useEffect(() => {
    if (!closeOnClickAway || !open) return undefined;
    const handleClickOutside = (event) => {
      if (
        panelRef.current
        && !panelRef.current.contains(event.target)
        && toggleBtnRef.current
        && !toggleBtnRef.current.contains(event.target)
      ) closeMenu();
    };
    const handleKeyDown = (event) => event.key === "Escape" && closeMenu();
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, closeOnClickAway, open]);

  return (
    <div
      className={`${className ? `${className} ` : ""}staggered-menu-wrapper${isFixed ? " fixed-wrapper" : ""}`}
      style={accentColor ? { "--sm-accent": accentColor } : undefined}
      data-position={position}
      data-open={open || undefined}
    >
      <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
        {(colors?.length ? colors.slice(0, 4) : ["#3e7bef", "#56c6b5", "#ffd400"]).map((color, index) => (
          <div key={`${color}-${index}`} className="sm-prelayer" style={{ background: color }} />
        ))}
      </div>

      <header ref={headerRef} className="staggered-menu-header" aria-label="Main navigation header">
        <a className="sm-logo" href="#top" aria-label="ARTStronomy home" onClick={closeMenu}>
          <img src={logoUrl} alt="ARTStronomy" className="sm-logo-img" draggable={false} width={220} height={53} />
        </a>
        <button
          ref={toggleBtnRef}
          className="sm-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="staggered-menu-panel"
          onClick={toggleMenu}
          type="button"
        >
          <span className="sm-toggle-textWrap" aria-hidden="true">
            <span ref={textInnerRef} className="sm-toggle-textInner">
              {textLines.map((line, index) => <span className="sm-toggle-line" key={`${line}-${index}`}>{line}</span>)}
            </span>
          </span>
          <span ref={iconRef} className="sm-icon" aria-hidden="true">
            <span ref={plusHRef} className="sm-icon-line" />
            <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
          </span>
        </button>
      </header>

      <aside
        id="staggered-menu-panel"
        ref={panelRef}
        className="staggered-menu-panel"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="sm-panel-inner">
          <ul className="sm-panel-list" role="list" data-numbering={displayItemNumbering || undefined}>
            {items.length ? items.map((item, index) => (
              <li className="sm-panel-itemWrap" key={`${item.label}-${index}`}>
                <a className="sm-panel-item" href={item.link} aria-label={item.ariaLabel} onClick={closeMenu}>
                  <span className="sm-panel-itemLabel">{item.label}</span>
                </a>
              </li>
            )) : (
              <li className="sm-panel-itemWrap" aria-hidden="true"><span className="sm-panel-item">No items</span></li>
            )}
          </ul>
          {displaySocials && socialItems.length > 0 && (
            <div className="sm-socials" aria-label="Social links">
              <h3 className="sm-socials-title">Follow the exhibition</h3>
              <ul className="sm-socials-list" role="list">
                {socialItems.map((social, index) => (
                  <li key={`${social.label}-${index}`} className="sm-socials-item">
                    <a href={social.link} target="_blank" rel="noopener noreferrer" className="sm-socials-link">
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default StaggeredMenu;
