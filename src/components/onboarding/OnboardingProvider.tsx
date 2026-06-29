import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface OnboardingData {
  projectName: string;
  projectDesc: string;
  productName: string;
  productCategory: string;
  productDescription: string;
  targetAudience: string;
  keyFeatures: string[];
  competitors: string[];
  keywords: string[];
  customInstructions: string;
}

export type WizardStep = "welcome" | "project" | "product" | "upload" | "analyze";

interface OnboardingContextType {
  wizardStep: WizardStep;
  setWizardStep: (step: WizardStep) => void;
  productSection: number; // 0: Info, 1: Analysis Context, 2: Review
  setProductSection: (section: number) => void;
  expandAll: boolean;
  setExpandAll: (val: boolean) => void;
  onboardingData: OnboardingData;
  setOnboardingData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  updateOnboardingField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void;
  brandDefaultsLoaded: boolean;
  loadBrandDefaults: (userEmail?: string) => Promise<void>;
  draftStatus: "saved" | "saving" | "restored" | "";
  setDraftStatus: (status: "saved" | "saving" | "restored" | "") => void;
  resetOnboarding: () => void;
}

const defaultData: OnboardingData = {
  projectName: "",
  projectDesc: "",
  productName: "",
  productCategory: "",
  productDescription: "",
  targetAudience: "",
  keyFeatures: [],
  competitors: [],
  keywords: [],
  customInstructions: ""
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wizardStep, setWizardStep] = useState<WizardStep>("welcome");
  const [productSection, setProductSection] = useState<number>(0);
  const [expandAll, setExpandAll] = useState<boolean>(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>(defaultData);
  const [brandDefaultsLoaded, setBrandDefaultsLoaded] = useState<boolean>(false);
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "restored" | "">("");

  const isInitialMount = useRef(true);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Recover draft from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("surveyiq_onboarding_draft");
      if (saved) {
        const { step, section, data, expanded } = JSON.parse(saved);
        if (step) setWizardStep(step);
        if (section !== undefined) setProductSection(section);
        if (expanded !== undefined) setExpandAll(expanded);
        if (data) setOnboardingData(data);
        
        setDraftStatus("restored");
        if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
        statusTimeoutRef.current = setTimeout(() => setDraftStatus(""), 3000);
      }
    } catch (e) {
      console.warn("Failed to load onboarding draft from LocalStorage:", e);
    }
    isInitialMount.current = false;
  }, []);

  // 2. Persist state shifts to LocalStorage
  useEffect(() => {
    if (isInitialMount.current) return;

    try {
      setDraftStatus("saving");
      localStorage.setItem(
        "surveyiq_onboarding_draft",
        JSON.stringify({
          step: wizardStep,
          section: productSection,
          expanded: expandAll,
          data: onboardingData
        })
      );
      
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = setTimeout(() => {
        setDraftStatus("saved");
        statusTimeoutRef.current = setTimeout(() => setDraftStatus(""), 2000);
      }, 500);
    } catch (e) {
      console.warn("Failed to save onboarding draft to LocalStorage:", e);
    }
  }, [wizardStep, productSection, expandAll, onboardingData]);

  const updateOnboardingField = <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => {
    setOnboardingData((prev) => ({ ...prev, [field]: value }));
  };

  const loadBrandDefaults = async (userEmail?: string) => {
    if (brandDefaultsLoaded) return;
    try {
      const res = await fetch("/api/organization/brand-settings", {
        headers: userEmail ? { "x-user-email": userEmail } : {}
      });
      if (res.ok) {
        const brandConfig = await res.json();
        if (brandConfig) {
          setOnboardingData((prev) => ({
            ...prev,
            productCategory: brandConfig.industry || prev.productCategory,
            competitors: brandConfig.competitors || prev.competitors,
            keywords: brandConfig.terminology || prev.keywords,
            customInstructions: brandConfig.customInstructions || prev.customInstructions
          }));
        }
      }
      setBrandDefaultsLoaded(true);
    } catch (err) {
      console.error("Failed to load organization brand defaults:", err);
    }
  };

  const resetOnboarding = () => {
    setOnboardingData(defaultData);
    setWizardStep("welcome");
    setProductSection(0);
    setExpandAll(false);
    setDraftStatus("");
    try {
      localStorage.removeItem("surveyiq_onboarding_draft");
    } catch (e) {
      console.warn("Failed to clear LocalStorage draft:", e);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        wizardStep,
        setWizardStep,
        productSection,
        setProductSection,
        expandAll,
        setExpandAll,
        onboardingData,
        setOnboardingData,
        updateOnboardingField,
        brandDefaultsLoaded,
        loadBrandDefaults,
        draftStatus,
        setDraftStatus,
        resetOnboarding
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
