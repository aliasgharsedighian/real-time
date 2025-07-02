// components/MyButton.tsx
import React, { useState } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
};

const getVariantStyle = (
  variant: ButtonVariant,
  isHover: boolean
): React.CSSProperties => {
  switch (variant) {
    case "secondary":
      return {
        backgroundColor: isHover ? "#cbd5e0" : "#e2e8f0", // darker gray on hover
        color: "#1a202c",
        border: "1px solid #cbd5e0",
      };
    case "ghost":
      return {
        backgroundColor: isHover ? "rgb(0 0 0 / 10%)" : "transparent",
        color: "#2b7fff",
        border: "1px solid transparent",
      };
    case "primary":
    default:
      return {
        backgroundColor: isHover ? "#1e66e5" : "#2b7fff", // darker blue on hover
        color: "#fff",
        border: "none",
      };
  }
};

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  style = {},
  disabled = false,
  type = "button",
  variant = "primary",
}) => {
  const [isHover, setIsHover] = useState(false);

  const baseStyle: React.CSSProperties = {
    borderStyle: "none",
    padding: "6px 10px",
    borderRadius: "4px",
    cursor: disabled ? "default" : "pointer",
    fontSize: "14px",
    fontWeight: 500,
    opacity: disabled ? 0.6 : 1,
    transition: "all 0.2s ease",
    margin: 0,
    ...getVariantStyle(variant, isHover),
    ...style,
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      style={baseStyle}
      onMouseEnter={() => {
        if (!disabled) {
          setIsHover(true);
        }
      }}
      onMouseLeave={() => setIsHover(false)}
    >
      {children}
    </button>
  );
};

export default Button;
