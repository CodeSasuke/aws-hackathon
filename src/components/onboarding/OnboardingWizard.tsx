import React from "react";
import { useOnboarding } from "./OnboardingProvider";
import WizardHeader from "./WizardHeader";
import WelcomeStep from "./steps/WelcomeStep";
import ProjectStep from "./steps/ProjectStep";
import ProductStep from "./steps/ProductStep";
import UploadStep from "./steps/UploadStep";

interface OnboardingWizardProps {
  onCancel: () => void;
  currentUser: any;
  onSuccess: (projectId: string) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onCancel, currentUser, onSuccess }) => {
  const { wizardStep, draftStatus } = useOnboarding();

  const renderStep = () => {
    switch (wizardStep) {
      case "welcome":
        return <WelcomeStep currentUser={currentUser} />;
      case "project":
        return <ProjectStep currentUser={currentUser} />;
      case "product":
        return <ProductStep currentUser={currentUser} />;
      case "upload":
      case "analyze":
        return <UploadStep currentUser={currentUser} onSuccess={onSuccess} />;
      default:
        return <WelcomeStep currentUser={currentUser} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      <WizardHeader onCancel={onCancel} />
      
      {/* Wizard Content Workspace */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200">
          {renderStep()}
        </div>
      </div>

      {/* Wizard Footer for Draft Saving Status */}
      <footer className="h-10 bg-white border-t border-gray-200 px-8 flex items-center justify-between text-[11px] text-gray-400 select-none">
        <div>
          {draftStatus === "saving" && (
            <span className="flex items-center text-blue-500 font-medium animate-pulse">
              Saving setup...
            </span>
          )}
          {draftStatus === "saved" && (
            <span className="text-emerald-600 font-medium flex items-center">
              Setup saved ✓
            </span>
          )}
          {draftStatus === "restored" && (
            <span className="text-blue-600 font-medium flex items-center">
              Restored previous draft ✓
            </span>
          )}
        </div>
        <div>
          <span>SurveyIQ Onboarding Wizard</span>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingWizard;
