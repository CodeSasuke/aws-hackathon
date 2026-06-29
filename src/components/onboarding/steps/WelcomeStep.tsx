import React, { useEffect, useState } from "react";
import { useOnboarding } from "../OnboardingProvider";
import { ArrowRight, Sparkles, AlertCircle } from "lucide-react";

interface WelcomeStepProps {
  currentUser: any;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ currentUser }) => {
  const { setWizardStep, loadBrandDefaults } = useOnboarding();
  const [hasBrandSettings, setHasBrandSettings] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(true);
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
      } finally {
        setChecking(false);
      }
    };

    checkBrandSettings();
    loadBrandDefaults(currentUser?.email);
  }, [currentUser]);

  const handleContinue = () => {
    setWizardStep("project");
  };

  return (
    <div className="p-8 text-center space-y-8 animate-fade-in font-sans">
      <div className="mx-auto h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
        <Sparkles className="h-6 w-6 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 font-sans">Create Project</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed font-sans">
          This takes about 2 minutes. We&apos;ll ask a a few simple questions about your product before analyzing your survey feedback.
        </p>
      </div>

      {/* Dismissible Organization Check callout */}
      {!checking && !hasBrandSettings && !dismissOrgPrompt && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left max-w-md mx-auto flex items-start space-x-3.5 shadow-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider font-sans">No Brand Defaults Found</h4>
            <p className="text-xs text-amber-700 leading-normal font-sans">
              To speed up future projects, you can configure your global organization brand guidelines (competitors, synonyms, etc.) once.
            </p>
            <div className="pt-2 flex items-center space-x-3 text-xs">
              <button
                onClick={() => {
                  // Dispatch a global event or trigger tab change on main page
                  window.dispatchEvent(new CustomEvent("switch-tab", { detail: "brand_settings" }));
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded transition-all font-sans"
              >
                Configure defaults
              </button>
              <button
                onClick={() => setDismissOrgPrompt(true)}
                className="text-amber-600 hover:text-amber-800 font-bold px-2 py-1.5 transition-all font-sans"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100">
        <button
          onClick={handleContinue}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-lg text-sm transition-all shadow-sm shadow-blue-100 flex items-center justify-center mx-auto group font-sans"
        >
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};

export default WelcomeStep;
