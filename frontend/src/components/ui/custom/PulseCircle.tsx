import { useEffect } from "react";

interface Props {
  size: string;
  color: string;
}

const PulseCircle = ({ size, color }: Props) => {
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      @keyframes pulse {
        0% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.2);
          opacity: 0.6;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      if (styleEl) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "100%",
        backgroundColor: color, // Tailwind blue-500
        animation: "pulse 1.5s infinite",
        display: "inline-block",
      }}
    />
  );
};

export default PulseCircle;
