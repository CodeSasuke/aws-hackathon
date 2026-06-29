import React from "react";

interface LogoProps {
  className?: string;
  variant?: "gradient" | "white" | "dark";
}

export const SurveyIQLogo: React.FC<LogoProps> = ({ 
  className = "h-6 w-6", 
  variant = "gradient"
}) => {
  const getColors = () => {
    switch (variant) {
      case "white":
        return {
          stroke: "#FFFFFF",
          sparkleFill: "#FFFFFF",
          useGradient: false
        };
      case "dark":
        return {
          stroke: "#1E293B", // slate-800
          sparkleFill: "#F59E0B", // amber-500
          useGradient: false
        };
      case "gradient":
      default:
        return {
          stroke: "url(#logoGrad)",
          sparkleFill: "url(#sparkGrad)",
          useGradient: true
        };
    }
  };

  const colors = getColors();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {colors.useGradient && (
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" /> {/* Blue 600 */}
            <stop offset="60%" stopColor="#3B82F6" /> {/* Blue 500 */}
            <stop offset="100%" stopColor="#10B981" /> {/* Emerald 500 */}
          </linearGradient>
          <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" /> {/* Amber 400 */}
            <stop offset="100%" stopColor="#F59E0B" /> {/* Amber 500 */}
          </linearGradient>
        </defs>
      )}

      {/* Bubble path representing survey feedback */}
      <path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.9021 3.5912 15.6672 4.6 17.1L3 21L6.9 19.4C8.3328 20.4088 10.0979 21 12 21Z"
        stroke={colors.stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Checkmark representing responses & validation */}
      <path
        d="M8.5 12L11 14.5L15.5 9.5"
        stroke={colors.stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Sparkle representing intelligence/insights */}
      <path
        d="M18 4C18 4.82843 18.6716 5.5 19.5 5.5C18.6716 5.5 18 6.17157 18 7C18 6.17157 17.3284 5.5 16.5 5.5C17.3284 5.5 18 4.82843 18 4Z"
        fill={colors.sparkleFill}
      />
    </svg>
  );
};

export default SurveyIQLogo;
