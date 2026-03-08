import { useState, useEffect } from "react";
import cobraLogo from "@/assets/cobra-logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
    const completeTimer = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(fadeTimer); clearTimeout(completeTimer); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-primary transition-opacity duration-600 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className={`flex flex-col items-center gap-4 transition-all duration-500 ${
        fadeOut ? "scale-110 opacity-0" : "scale-100 opacity-100"
      }`}>
        <img
          src={cobraLogo}
          alt="COBRA"
          className="h-24 w-auto brightness-0 invert animate-scale-in"
        />
        <div className="h-0.5 w-16 bg-primary-foreground/30 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-primary-foreground/70 rounded-full animate-[loading_2s_ease-in-out]" />
        </div>
      </div>
    </div>
  );
}
