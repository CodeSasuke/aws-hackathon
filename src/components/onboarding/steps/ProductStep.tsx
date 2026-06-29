import React, { useState, useEffect } from "react";
import { useOnboarding } from "../OnboardingProvider";
import { ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Eye, Sparkles } from "lucide-react";

interface ProductStepProps {
  currentUser: any;
}

// ─── CUSTOM CHIP EDITOR FOR ARRAY FIELDS ─────────────────────────────────────
interface ChipEditorProps {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (newValues: string[]) => void;
  suggestions?: string[];
}

const ChipEditor: React.FC<ChipEditorProps> = ({ label, placeholder, values, onChange, suggestions = [] }) => {
  const [inputVal, setInputVal] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = inputVal.trim();
      if (val && !values.includes(val)) {
        onChange([...values, val]);
      }
      setInputVal("");
    }
  };

  const handleRemove = (valToRemove: string) => {
    onChange(values.filter((v) => v !== valToRemove));
  };

  const filteredSuggestions = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-1.5 font-sans">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 border border-gray-250 hover:border-gray-350 focus-within:border-blue-500 rounded-lg min-h-10 transition-all">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded border border-blue-100 font-sans"
          >
            {v}
            <button
              type="button"
              onClick={() => handleRemove(v)}
              className="ml-1.5 text-blue-500 hover:text-blue-800 font-bold focus:outline-none"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none outline-none text-xs p-0.5 text-gray-800 min-w-20"
        />
      </div>

      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-1.5">
          <span className="text-[10px] text-gray-400 font-medium mr-1.5">Suggestions:</span>
          {filteredSuggestions.slice(0, 5).map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChange([...values, s])}
              className="text-[10px] bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded transition-all font-sans"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── MAIN PRODUCT STEP COMPONENT ─────────────────────────────────────────────
export const ProductStep: React.FC<ProductStepProps> = ({ currentUser }) => {
  const {
    onboardingData,
    updateOnboardingField,
    setWizardStep,
    productSection,
    setProductSection,
    expandAll,
    setExpandAll
  } = useOnboarding();

  const [orgSuggestions, setOrgSuggestions] = useState<any>({ competitors: [], terminology: [] });

  // Load organization-wide brand settings for autocomplete suggestions
  useEffect(() => {
    const fetchOrgSettings = async () => {
      try {
        const res = await fetch("/api/organization/brand-settings", {
          headers: currentUser?.email ? { "x-user-email": currentUser.email } : {}
        });
        if (res.ok) {
          const config = await res.json();
          if (config) {
            setOrgSuggestions({
              competitors: config.competitors || [],
              terminology: config.terminology || []
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete suggestions", err);
      }
    };
    fetchOrgSettings();
  }, [currentUser]);

  // Suggested product categories
  const categorySuggestions = [
    "SaaS / Technology",
    "Consumer Goods",
    "E-Commerce",
    "Food & Beverages",
    "Entertainment / Media",
    "Education",
    "Financial Services"
  ];

  const handleNext = () => {
    if (expandAll) {
      setWizardStep("upload");
    } else {
      if (productSection === 0) {
        setProductSection(1);
      } else if (productSection === 1) {
        setProductSection(2);
      } else {
        setWizardStep("upload");
      }
    }
  };

  const handleBack = () => {
    if (expandAll) {
      setWizardStep("project");
    } else {
      if (productSection === 0) {
        setWizardStep("project");
      } else {
        setProductSection(productSection - 1);
      }
    }
  };

  const canContinue = () => {
    if (productSection === 0 && !expandAll) {
      return onboardingData.productName.trim() && onboardingData.productCategory.trim();
    }
    if (expandAll) {
      return onboardingData.productName.trim() && onboardingData.productCategory.trim();
    }
    return true;
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in font-sans">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Step 2 of 3</span>
          <h2 className="text-xl font-bold text-gray-900 font-sans">Help SurveyIQ understand your product</h2>
          <p className="text-xs text-gray-500 font-sans">This context guides the local matching engine to categorize themes correctly.</p>
        </div>

        {/* Expand All toggle */}
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="flex items-center text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors border border-gray-200 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-150"
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          {expandAll ? "Guided Mode" : "Expand All"}
        </button>
      </div>

      <div className="space-y-4 pt-2">
        {expandAll ? (
          // QUICK SETUP MODE: Render all fields on one screen
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Product Name</label>
                <input
                  type="text"
                  value={onboardingData.productName}
                  onChange={(e) => updateOnboardingField("productName", e.target.value)}
                  placeholder="e.g. Prime Video"
                  className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Product Category</label>
                <input
                  type="text"
                  value={onboardingData.productCategory}
                  onChange={(e) => updateOnboardingField("productCategory", e.target.value)}
                  placeholder="e.g. Streaming Service"
                  className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Short Product Description</label>
              <textarea
                value={onboardingData.productDescription}
                onChange={(e) => updateOnboardingField("productDescription", e.target.value)}
                placeholder="A brief overview of the value proposition..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Target Audience</label>
              <input
                type="text"
                value={onboardingData.targetAudience}
                onChange={(e) => updateOnboardingField("targetAudience", e.target.value)}
                placeholder="e.g. Students, working professionals"
                className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
              />
            </div>

            <ChipEditor
              label="Key Product Features"
              placeholder="e.g. Offline downloads, offline play (Press Enter to add)"
              values={onboardingData.keyFeatures}
              onChange={(newVals) => updateOnboardingField("keyFeatures", newVals)}
            />

            <ChipEditor
              label="Product Competitors"
              placeholder="e.g. Netflix, Disney+ (Press Enter to add)"
              values={onboardingData.competitors}
              onChange={(newVals) => updateOnboardingField("competitors", newVals)}
              suggestions={orgSuggestions.competitors}
            />

            <ChipEditor
              label="Important Keywords / Synonyms"
              placeholder="e.g. stream, video, offline (Press Enter to add)"
              values={onboardingData.keywords}
              onChange={(newVals) => updateOnboardingField("keywords", newVals)}
              suggestions={orgSuggestions.terminology}
            />
          </div>
        ) : (
          // GUIDED MODE: Accordion sections with auto-expansion
          <div className="space-y-3">
            {/* SECTION 1: GENERAL INFO */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setProductSection(0)}
                className="w-full bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider"
              >
                <span className="flex items-center">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center mr-2 text-[10px] ${productSection >= 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>1</span>
                  Tell us about your product
                </span>
                {productSection === 0 ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>

              {productSection === 0 && (
                <div className="p-4 space-y-4 animate-slide-down">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Product Name</label>
                      <input
                        type="text"
                        value={onboardingData.productName}
                        onChange={(e) => updateOnboardingField("productName", e.target.value)}
                        placeholder="e.g. Prime Video"
                        className="w-full bg-white border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Product Category</label>
                      <input
                        type="text"
                        value={onboardingData.productCategory}
                        onChange={(e) => updateOnboardingField("productCategory", e.target.value)}
                        placeholder="e.g. Streaming Service"
                        className="w-full bg-white border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                      />
                      <div className="flex flex-wrap gap-1 items-center pt-1.5">
                        <span className="text-[10px] text-gray-400 font-medium mr-1.5">Suggestions:</span>
                        {categorySuggestions.slice(0, 4).map((cat, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => updateOnboardingField("productCategory", cat)}
                            className="text-[10px] bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded transition-all font-sans"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Short Product Description</label>
                    <textarea
                      value={onboardingData.productDescription}
                      onChange={(e) => updateOnboardingField("productDescription", e.target.value)}
                      placeholder="A brief overview of the value proposition..."
                      rows={2}
                      className="w-full bg-white border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: CONTEXT / ATTRIBUTES */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  if (onboardingData.productName.trim() && onboardingData.productCategory.trim()) {
                    setProductSection(1);
                  }
                }}
                disabled={!onboardingData.productName.trim() || !onboardingData.productCategory.trim()}
                className="w-full bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center mr-2 text-[10px] ${productSection >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>2</span>
                  Context details & attributes
                </span>
                {productSection === 1 ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>

              {productSection === 1 && (
                <div className="p-4 space-y-4 animate-slide-down">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Target Audience</label>
                    <input
                      type="text"
                      value={onboardingData.targetAudience}
                      onChange={(e) => updateOnboardingField("targetAudience", e.target.value)}
                      placeholder="e.g. Students, working professionals"
                      className="w-full bg-white border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-sans font-medium"
                    />
                  </div>

                  <ChipEditor
                    label="Key Features"
                    placeholder="e.g. Offline downloads, watchlist (Press Enter to add)"
                    values={onboardingData.keyFeatures}
                    onChange={(newVals) => updateOnboardingField("keyFeatures", newVals)}
                  />

                  <ChipEditor
                    label="Competitors"
                    placeholder="e.g. Netflix, Disney+ (Press Enter to add)"
                    values={onboardingData.competitors}
                    onChange={(newVals) => updateOnboardingField("competitors", newVals)}
                    suggestions={orgSuggestions.competitors}
                  />

                  <ChipEditor
                    label="Terminology / Keywords"
                    placeholder="e.g. stream, video, offline (Press Enter to add)"
                    values={onboardingData.keywords}
                    onChange={(newVals) => updateOnboardingField("keywords", newVals)}
                    suggestions={orgSuggestions.terminology}
                  />
                </div>
              )}
            </div>

            {/* SECTION 3: INLINE REVIEW CARD */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  if (onboardingData.productName.trim() && onboardingData.productCategory.trim()) {
                    setProductSection(2);
                  }
                }}
                disabled={!onboardingData.productName.trim() || !onboardingData.productCategory.trim()}
                className="w-full bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center">
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center mr-2 text-[10px] ${productSection === 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>3</span>
                  Review setup details
                </span>
                {productSection === 2 ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>

              {productSection === 2 && (
                <div className="p-4 space-y-4 animate-slide-down bg-gray-50">
                  <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4 border-b border-gray-100 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Product Name</span>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{onboardingData.productName || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Category</span>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">{onboardingData.productCategory || "N/A"}</p>
                      </div>
                    </div>

                    <div className="border-b border-gray-100 pb-3">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Description</span>
                      <p className="text-xs text-gray-600 mt-0.5 leading-normal">{onboardingData.productDescription || "No description provided."}</p>
                    </div>

                    <div className="border-b border-gray-100 pb-3">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Target Audience</span>
                      <p className="text-xs text-gray-600 mt-0.5">{onboardingData.targetAudience || "No specific audience targeted."}</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Key Features</span>
                        {onboardingData.keyFeatures.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None configured</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {onboardingData.keyFeatures.map((f, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Competitors</span>
                        {onboardingData.competitors.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None configured</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {onboardingData.competitors.map((c, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Keywords</span>
                        {onboardingData.keywords.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">None configured</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {onboardingData.keywords.map((k, i) => (
                              <span key={i} className="bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded border border-gray-200">{k}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
          disabled={!canContinue()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm shadow-blue-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed group font-sans"
        >
          {expandAll || productSection === 2 ? "Ready to Upload" : "Continue"}
          <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};

export default ProductStep;
