'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface ScrollExpandMediaProps {
  mediaSrc: string;
  posterSrc?: string;
  /** Imagem de fundo (opcional). Se omitida, usa bgColor. */
  bgImageSrc?: string;
  /** Gradiente/cor de fundo quando não há imagem */
  bgColor?: string;
  /** Texto que aparece centralizado antes da expansão */
  scrollToExpand?: string;
  children?: ReactNode;
}

const ScrollExpandMedia = ({
  mediaSrc,
  bgImageSrc,
  bgColor = 'linear-gradient(135deg, #0f1e1b 0%, #0e7a6e 100%)',
  scrollToExpand,
  children,
}: ScrollExpandMediaProps) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);

  /* Detecta mobile */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* Scroll / touch hijacking durante a expansão */
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
        return;
      }
      if (!mediaFullyExpanded) {
        e.preventDefault();
        const next = Math.min(Math.max(scrollProgress + e.deltaY * 0.0009, 0), 1);
        setScrollProgress(next);
        if (next >= 1) { setMediaFullyExpanded(true); setShowContent(true); }
        else if (next < 0.75) setShowContent(false);
      }
    };

    const handleTouchStart = (e: TouchEvent) => setTouchStartY(e.touches[0].clientY);

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartY) return;
      const delta = touchStartY - e.touches[0].clientY;
      if (mediaFullyExpanded && delta < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        e.preventDefault();
        return;
      }
      if (!mediaFullyExpanded) {
        e.preventDefault();
        const factor = delta < 0 ? 0.008 : 0.005;
        const next = Math.min(Math.max(scrollProgress + delta * factor, 0), 1);
        setScrollProgress(next);
        if (next >= 1) { setMediaFullyExpanded(true); setShowContent(true); }
        else if (next < 0.75) setShowContent(false);
        setTouchStartY(e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => setTouchStartY(0);

    /* Enquanto não expandiu, mantém posição no topo */
    const handleScroll = () => { if (!mediaFullyExpanded) window.scrollTo(0, 0); };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollProgress, mediaFullyExpanded, touchStartY]);

  /* Dimensões da mídia conforme o progresso */
  const mediaW = 320 + scrollProgress * (isMobile ? 600 : 1200);
  const mediaH = 200 + scrollProgress * (isMobile ? 250 : 480);
  const textShift = scrollProgress * (isMobile ? 180 : 160);

  return (
    <div ref={sectionRef} className="overflow-x-hidden">
      <section className="relative flex flex-col items-center justify-start min-h-[100dvh]">
        <div className="relative w-full flex flex-col items-center min-h-[100dvh]">

          {/* ── Fundo ──────────────────────────────────────────── */}
          <motion.div
            className="absolute inset-0 z-0 h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - scrollProgress }}
            transition={{ duration: 0.1 }}
          >
            {bgImageSrc ? (
              <Image
                src={bgImageSrc}
                alt="Fundo"
                width={1920}
                height={1080}
                className="w-screen h-screen object-cover object-center"
                priority
              />
            ) : (
              <div className="w-full h-full" style={{ background: bgColor }} />
            )}
            <div className="absolute inset-0 bg-black/20" />
          </motion.div>

          {/* ── Mídia expansível ───────────────────────────────── */}
          <div className="container mx-auto flex flex-col items-center justify-start relative z-10">
            <div className="flex flex-col items-center justify-center w-full h-[100dvh] relative">

              {/* Container da imagem */}
              <div
                className="absolute z-0 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden"
                style={{
                  width: `${mediaW}px`,
                  height: `${mediaH}px`,
                  maxWidth: '96vw',
                  maxHeight: '88vh',
                  boxShadow: '0 8px 60px rgba(0,0,0,0.35)',
                  transition: 'none',
                }}
              >
                <Image
                  src={mediaSrc}
                  alt="Sistema AgendeFácil"
                  width={1456}
                  height={816}
                  className="w-full h-full object-cover object-top"
                  priority
                />
                {/* Overlay que some conforme expande */}
                <motion.div
                  className="absolute inset-0 bg-black/40 rounded-2xl"
                  animate={{ opacity: 0.6 - scrollProgress * 0.6 }}
                  transition={{ duration: 0.1 }}
                />
              </div>

              {/* Texto animado (separa conforme o scroll) */}
              {scrollToExpand && (
                <div className="relative z-10 flex flex-col items-center gap-2 pointer-events-none">
                  <p
                    className="text-sm font-medium text-white/80 tracking-widest uppercase"
                    style={{ transform: `translateX(${textShift}vw)`, transition: 'none' }}
                  >
                    {scrollToExpand}
                  </p>
                  {/* Seta animada */}
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                    className="text-white/60"
                    style={{
                      opacity: 1 - scrollProgress * 2,
                      transform: `translateX(-${textShift}vw)`,
                      transition: 'opacity 0.1s',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10 3v14M4 11l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>
                </div>
              )}
            </div>

            {/* ── Conteúdo pós-expansão ──────────────────────── */}
            <motion.section
              className="flex flex-col w-full px-6 py-10 md:px-16 lg:py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              {children}
            </motion.section>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ScrollExpandMedia;
