import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Scroll progress as a lightsaber along the bottom of the screen: the hilt
// sits in the corner and the blade extends as you read. One transform per frame.
export default function ScrollSaber() {
  const { pathname } = useLocation();
  const blade = useRef(null);
  const wrap = useRef(null);

  useEffect(() => {
    let frame = 0;
    let max = 1;
    const measure = () => {
      max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (wrap.current) wrap.current.style.opacity = max > 40 ? '1' : '0';
    };
    const draw = () => {
      frame = 0;
      if (blade.current) blade.current.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onResize = () => {
      measure();
      onScroll();
    };
    measure();
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    ro?.observe(document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [pathname]);

  return (
    <div ref={wrap} className="saber-progress" aria-hidden="true">
      <span className="hilt" />
      <span ref={blade} className="blade" />
    </div>
  );
}
