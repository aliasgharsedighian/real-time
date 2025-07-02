import { useEffect } from "react";

interface Props {
  width: number;
  height: number;
  color: string;
}

const injectSpinnerKeyframes = () => {
  const style = document.createElement("style");
  style.innerHTML = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
};

const Spinner = ({ width, height, color }: Props) => {
  useEffect(() => {
    injectSpinnerKeyframes();
  }, []);

  return (
    <div
      style={{
        display: "inline-block",
        width,
        height,
        border: `${Math.floor(width / 10)}px solid rgba(0, 0, 0, 0.1)`,
        borderTop: `${Math.floor(width / 10)}px solid ${color}`,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
  );
};

export default Spinner;
