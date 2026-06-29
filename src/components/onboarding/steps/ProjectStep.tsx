import React, { useEffect, useState } from "react";
import { useOnboarding } from "../OnboardingProvider";
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";

interface ProjectStepProps {
  currentUser: any;
}

export const ProjectStep: React.FC<ProjectStepProps> = ({ currentUser }) => {
  const { onboardingData, updateOnboardingField, setWizardStep } = useOnboarding();
  const [hasBrandSettings, setHasBrandSettings] = useState<boolean>(true);
  const [dismissOrgPrompt, setDismissOrgPrompt] = useState<boolean>(false);

  useEffect(() => {
    const checkBrandSettings = async () => {
      try {
        const res = await fetch("/api/organization/brand-settings", {
          headers: currentUser?.email ? { "x-user-email": currentUser.email } : {}
        });
        if (res.ok) {
          const config = await res.json();
          if (!config || !config.companyName) {
            setHasBrandSettings(false);
          }
        } else {
          setHasBrandSettings(false);
        }
      } catch (err) {
        setHasBrandSettings(false);
      }
    };
    checkBrandSettings();
  }, [currentUser]);

  const handleNext = () => {
    if (!onboardingData.projectName.trim()) return;
    setWizardStep("product");
  };

  const handleBack = () => {
    setWizardStep("welcome");
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in font-sans">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Step 1 of 3</span>
        <h2 className="text-xl font-bold text-gray-900 font-sans">What would you like to call this project?</h2>
        <p className="text-xs text-gray-500 font-sans">Give your analysis workspace a clean and descriptive title.</p>
      </div>

      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600">Project Name</label>
          <input
            type="text"
            value={onboardingData.projectName}
            onChange={(e) => updateOnboardingField("projectName", e.target.value)}
            placeholder="e.g. Q3 Customer Satisfaction Surveys"
            className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-sm text-gray-800 outline-none transition-all font-sans font-medium"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-600">Project Description (Optional)</label>
          <textarea
            value={onboardingData.projectDesc}
            onChange={(e) => updateOnboardingField("projectDesc", e.target.value)}
            placeholder="Explain the objectives, target group, or source of this feedback..."
            rows={3}
            className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-sm text-gray-800 outline-none transition-all font-sans font-medium"
          />
        </div>
      </div>

      {/* Dismissible Brand Settings Callout (only if missing) */}
      {!hasBrandSettings && !dismissOrgPrompt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3.5 shadow-sm mt-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider font-sans">No Brand Defaults Found</h4>
            <p className="text-xs text-amber-700 leading-normal font-sans">
              Global brand settings aren&apos;t configured yet. You can set them up now to automatically apply settings to future projects, or continue with project overrides.
            </p>
            <div className="pt-2 flex items-center space-x-3 text-xs">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("switch-tab", { detail: "brand_settings" }));
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded transition-all font-sans"
              >
                Configure defaults
              </button>
              <button
                onClick={() => setDismissOrgPrompt(true)}
                className="text-amber-650 hover:text-amber-800 font-bold px-2 py-1.5 transition-all font-sans"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors flex items-center px-4 py-2 border border-transparent rounded-lg font-sans"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </button>

        <button
          onClick={handleNext}
          disabled={!onboardingData.projectName.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm shadow-blue-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed group font-sans"
        >
          Continue
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};

export default ProjectStep;
