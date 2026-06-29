import React from "react";
import { useOnboarding } from "./OnboardingProvider";
import { Sparkles, X } from "lucide-react";

interface WizardHeaderProps {
  onCancel: () => void;
}

export const WizardHeader: React.FC<WizardHeaderProps> = ({ onCancel }) => {
  const { wizardStep } = useOnboarding();

  const getStepClass = (activeSteps: string[]) => {
    const isActive = activeSteps.includes(wizardStep);
    return isActive
      ? "text-blue-600 font-bold border-b-2 border-blue-600 pb-3"
      : "text-gray-400 font-medium pb-3";
  };

  return (
    <header className="h-16 bg-white border-b border-gray-150 flex items-center justify-between px-8 select-none">
      <div className="flex items-center space-x-2">
        <div className="h-8 w-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-md shadow-blue-100">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <span className="font-bold text-base text-gray-900 tracking-tight font-sans">SurveyIQ</span>
      </div>

      {/* Stable Progress Indicator */}
      <div className="flex items-center space-x-6 text-xs uppercase tracking-wider">
        <span className={`transition-colors duration-250 ${getStepClass(["welcome", "project"])}`}>
          1. Project
        </span>
        <span className="text-gray-300 font-light pb-3">─────</span>
        <span className={`transition-colors duration-250 ${getStepClass(["product"])}`}>
          2. Product
        </span>
        <span className="text-gray-300 font-light pb-3">─────</span>
        <span className={`transition-colors duration-250 ${getStepClass(["upload", "analyze"])}`}>
          3. Upload
        </span>
      </div>

      <button
        onClick={onCancel}
        className="flex items-center text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded bg-white shadow-sm font-sans"
      >
        <X className="h-3.5 w-3.5 mr-1.5" />
        Cancel Setup
      </button>
    </header>
  );
};
export default WizardHeader;
