import React, { useState, useEffect } from "react";
import { Plus, Trash2, Sparkles, HelpCircle, Briefcase, Tag, Target, FileText, Sliders } from "lucide-react";

interface ProductSettingsViewProps {
  projectId: string;
  currentUser: any;
  onUpdate: () => void;
}

// ─── CHIP EDITOR FOR ARRAY FIELDS ────────────────────────────────────────────
interface ChipEditorProps {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (newValues: string[]) => void;
}

const ChipEditor: React.FC<ChipEditorProps> = ({ label, placeholder, values, onChange }) => {
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

  return (
    <div className="space-y-1.5 font-sans">
      <label className="text-xs font-semibold text-gray-500">{label}</label>
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
    </div>
  );
};

// ─── MAIN PRODUCT SETTINGS VIEW COMPONENT ────────────────────────────────────
export const ProductSettingsView: React.FC<ProductSettingsViewProps> = ({ projectId, currentUser, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyFeatures, setKeyFeatures] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  
  // Custom categories state: array of { name: string, themes: { name: string, synonyms: string[] }[] }
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const fetchProductSettings = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/nlp-config`);
        if (res.ok) {
          const config = await res.json();
          if (config) {
            setProductName(config.productName || "");
            setProductCategory(config.category || "");
            setProductDescription(config.description || "");
            setTargetAudience(config.audience || "");
            setKeyFeatures(config.features || []);
            setCompetitors(config.competitors || []);
            setKeywords(config.keywords || []);
            setCustomInstructions(config.customInstructions || "");
            setCategories(config.categories || []);
          }
        }
      } catch (err) {
        console.error("Error fetching product settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProductSettings();
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        productName,
        category: productCategory,
        description: productDescription,
        audience: targetAudience,
        features: keyFeatures,
        competitors,
        keywords,
        customInstructions,
        categories
      };

      const res = await fetch(`/api/projects/${projectId}/nlp-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Product profile updated successfully.");
        onUpdate();
      } else {
        alert("Failed to update product profile.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving configurations.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 font-sans text-sm text-gray-500 space-x-2">
        <Sliders className="h-5 w-5 animate-spin text-blue-600" />
        <span>Loading Product Profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">Product Settings</h2>
          <p className="text-xs text-gray-500 mt-1 font-sans">
            Customize settings specific to this project. Changes apply to future analyses.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded text-xs transition-all shadow shadow-blue-100 disabled:opacity-50 font-sans"
        >
          {saving ? "Saving Profile..." : "Save Product Settings"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Columns: Product Info, Description, Custom Themes */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Card: Product Profile */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <Briefcase className="h-4.5 w-4.5 text-blue-500" />
              <h3 className="font-bold text-sm text-gray-800 font-sans">Product Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Michelob Ultra"
                  className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-medium font-sans"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Product Category</label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  placeholder="e.g. Light Beer"
                  className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-medium font-sans"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Product Description</label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="A brief overview of the value proposition..."
                rows={3}
                className="w-full bg-gray-50 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-medium font-sans"
              />
            </div>
          </div>

          {/* Card: Project Taxonomy settings */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-2">
                <Tag className="h-4.5 w-4.5 text-blue-500" />
                <h3 className="font-bold text-sm text-gray-800 font-sans">Project Categories & Themes</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategories([
                    ...categories,
                    { name: "New Category", themes: [{ name: "General Theme", synonyms: [] }] }
                  ]);
                }}
                className="text-xs text-blue-600 hover:text-blue-755 font-bold flex items-center font-sans"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
              </button>
            </div>

            <div className="space-y-4">
              {categories.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No project-specific categories configured.</p>
              ) : (
                categories.map((cat, catIdx) => (
                  <div key={catIdx} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
                    <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category:</span>
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => {
                            const updated = [...categories];
                            updated[catIdx].name = e.target.value;
                            setCategories(updated);
                          }}
                          className="bg-transparent font-bold text-xs text-gray-800 outline-none border-b border-dashed border-gray-300 focus:border-blue-500 px-1 py-0.5"
                        />
                      </div>
                      
                      <div className="flex items-center space-x-3 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...categories];
                            updated[catIdx].themes.push({ name: "New Theme", synonyms: [] });
                            setCategories(updated);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          + Add Theme
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCategories(categories.filter((_, idx) => idx !== catIdx));
                          }}
                          className="text-red-500 hover:text-red-755 flex items-center animate-fade-in"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 space-y-3 bg-white">
                      {cat.themes.map((theme: any, themeIdx: number) => (
                        <div key={themeIdx} className="flex items-center justify-between border-b border-gray-100 last:border-0 pb-2.5 last:pb-0">
                          <div className="flex-1 grid grid-cols-2 gap-4 mr-4">
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-gray-400">Theme</span>
                              <input
                                type="text"
                                value={theme.name}
                                onChange={(e) => {
                                  const updated = [...categories];
                                  updated[catIdx].themes[themeIdx].name = e.target.value;
                                  setCategories(updated);
                                }}
                                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 font-semibold text-gray-700"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[9px] uppercase font-bold text-gray-400">Synonyms (comma separated)</span>
                              <input
                                type="text"
                                value={theme.synonyms?.join(", ") || ""}
                                onChange={(e) => {
                                  const updated = [...categories];
                                  updated[catIdx].themes[themeIdx].synonyms = e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  setCategories(updated);
                                }}
                                className="w-full bg-gray-55 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 text-gray-700 font-medium"
                                placeholder="e.g. light, smooth"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...categories];
                              updated[catIdx].themes = updated[catIdx].themes.filter(
                                (_: any, idx: number) => idx !== themeIdx
                              );
                              setCategories(updated);
                            }}
                            className="text-red-400 hover:text-red-755 text-xs font-bold pt-3"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Key Attributes & Defaults overrides */}
        <div className="space-y-6">
          
          {/* Card: Product Attributes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <Target className="h-4.5 w-4.5 text-blue-500" />
              <h3 className="font-bold text-sm text-gray-800 font-sans">Product Profile</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Target Audience</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Active drinkers, students"
                className="w-full bg-gray-55 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-medium font-sans"
              />
            </div>

            <ChipEditor
              label="Key Features"
              placeholder="e.g. Low calorie, crisp taste"
              values={keyFeatures}
              onChange={setKeyFeatures}
            />

            <ChipEditor
              label="Competitors"
              placeholder="e.g. Bud Light, Miller Lite"
              values={competitors}
              onChange={setCompetitors}
            />

            <ChipEditor
              label="Keywords & Synonyms"
              placeholder="e.g. refreshing, smooth"
              values={keywords}
              onChange={setKeywords}
            />
          </div>

          {/* Card: Prompt Instructions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <Sparkles className="h-4.5 w-4.5 text-blue-500" />
              <h3 className="font-bold text-sm text-gray-800 font-sans">Analysis Instructions</h3>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Custom Prompts</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Specify target instructions for survey classification overrides..."
                rows={4}
                className="w-full bg-gray-55 border border-gray-250 hover:border-gray-350 focus:border-blue-500 rounded-lg p-2.5 text-xs text-gray-800 outline-none transition-all font-medium font-sans"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSettingsView;
