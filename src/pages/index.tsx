import { useEffect, useRef } from 'react';
import ImageMapCreator from '@/components/editor';

function Home() {
  const ref = useRef(null);
  const canvas = useRef<ImageMapCreator>();
  
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !ref.current ||
      canvas.current
    ) return;

    canvas.current = new ImageMapCreator(ref.current);

    return () => {
      // canvas.current?.p5.remove();
    };
  }, []);

  return (
    <>
      <div ref={ref} className="canvas-container"></div>
    </>
  );
}

export default Home;
